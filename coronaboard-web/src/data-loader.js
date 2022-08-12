// 각종 라이브러리 가져오기
const axios = require('axios');
const { subDays } = require('date-fns');
const { format, utcToZonedTime } = require('date-fns-tz');
const _ = require('lodash');

const countryInfo = require('../../tools/downloaded/countryInfo.json');
const ApiClient = require('./api-client');
const notice = require('../../tools/downloaded/notice.json');

const path = require('path');
const fs = require('fs-extra');

async function getDataSource() {
    const countryByCc = _.keyBy(countryInfo, 'cc');
    const apiClient = new ApiClient();

    // 7장에서 수집해서 저장해둔 전세계 통계를 로드
    const allGlobalStats = await apiClient.getAllGlobalStats(); // 국가별 데이터 로드
    // 날짜별로 데이터를 묶는 부분을 기존 generateGlobalStats() 함수에서 추출
    const groupedByDate = _.groupBy(allGlobalStats, 'date');
    const globalStats = generateGlobalStats(groupedByDate);
    const globalChartDataByCc = generateGlobalChartDataByCc(groupedByDate);

    // 전 기간에 대한 국가별 데이터는 양이 많기 때문에 전부 정적 웹페이지에 주입해버리면 페이지 용량이 크게 증가되고
    // 이 때문에 초기 로딩이 느림. 따라서 국가 코드별로 나누어서 json 파일로 저장해 두고 사용자 선택에 따라
    // 필요시점에 API 호출하듯이 json 파일을 요청하여 국가별 데이터를 로드할 수 있게 함
    Object.keys(globalChartDataByCc).forEach((cc) => {
        // static/generated 디렉터리는 데이터에따라 매번 생성되는 파일이기 때문에 .gitignore에 추가해서 git 저장소에 추가되지 않도록 할것
        const genPath = path.join(process.cwd(), `static/generated/${cc}.json`);
        fs.outputFileSync(genPath, JSON.stringify(globalChartDataByCc[cc]));
    });

    return {
        lastUpdated: Date.now(), // 데이터를 만든 현재 시간 기록
        globalStats,
        countryByCc,
        // 공지사항 목록 중 hidden 필드가 false인 항목만 필터하여 전달
        notice: notice.filter((x) => !x.hidden),
    };
}

function generateGlobalStats(groupedByDate) {
    /*
    // HTTP 클라이언트 생성
    const apiClient = axios.create({
        baseURL: process.env.CORONABOARD_API_BASE_URL || 'http://localhost:8080',
    });

    // GET /global-stats API 호출
    const response = await apiClient.get('global-stats');

    // 날짜 기준 그룹핑
    const groupedByDate = _.groupBy(response.data.result, 'date');
    */

    // 오늘/어제 날짜 생성
    // 데이터가 제공되는 마지막 날짜로 Date 객체 생성
    // const now = new Date(); // 현재 시각의 Date 객체 생성
    const now = new Date('2021-06-05');
    const timeZone = 'Asia/Seoul'; // 시간대 = 한국(서울)
    const today = format(utcToZonedTime(now, timeZone), 'yyyy-MM-dd');
    const yesterday = format(
        utcToZonedTime(subDays(now, 1), timeZone),
        'yyyy-MM-dd',
    );

    // 오늘 날짜에 대한 데이터가 존재하지 않는 경우 오류 발생시키기
    if (!groupedByDate[today]) {
        throw new Error('Data for today is missing');
    }

    // 오늘, 어제 데이터를 모두 가진 객체를 생성해 반환
    return createGlobalStatWithPrevField(
        groupedByDate[today],
        groupedByDate[yesterday],
    );
}

// 오늘, 어제 데이터를 모두 가진 객체 생성
function createGlobalStatWithPrevField(todayStats, yesterdayStats) {
    // 어제 데이터를 국가 코드 기준으로 찾을 수 있게 변환
    const yesterdayStatsByCc = _.keyBy(yesterdayStats, 'cc');

    // 국가별로 오늘 데이터와 어제 데이털르 한 번에 가질 수 있게 데이터 변환
    const globalStatWithPrev = todayStats.map((todayStat) => {
        const cc = todayStat.cc;
        const yesterdayStat = yesterdayStatsByCc[cc];
        // 어제 데이터가 존재하면 오늘 데이터 필드 외에 xxxxPrev 형태로
        // 어제 데이터 필드 추가
        if (yesterdayStat) {
            return {
                ...todayStat,
                confirmedPrev: yesterdayStat.confirmed || 0,
                deathPrev: yesterdayStat.death || 0,
                negativePrev: yesterdayStat.negative || 0,
                releasedPrev: yesterdayStat.released || 0,
                testedPrev: yesterdayStat.tested || 0,
            };
        }

        return todayStat;
    });

    return globalStatWithPrev;
}

function generateGlobalChartDataByCc(groupedByDate) {
    // 국가 코드를 필드 이름으로 하여 차트 데이터를 저장해둘 객체 선언
    const chartDataByCc = {};
    // 모든 키값(날짜)를 불러와서 날짜순으로 정렬
    const dates = Object.keys(groupedByDate).sort();
    for (const date of dates) {
        const countriesDataForOneDay = groupedByDate[date];
        for (const countryData of countriesDataForOneDay) {
            const cc = countryData.cc;
            // 특정 국가의 차트 데이터를 나타내는 객체가 아직 정의되지 않았다면 기본 형태로 생성
            if (!chartDataByCc[cc]) {
                chartDataByCc[cc] = {
                    date: [],
                    confirmed: [],
                    confirmedAcc: [],
                    death: [],
                    deathAcc: [],
                    released: [],
                    releasedAcc: [],
                };
            }

            appendToChartData(chartDataByCc[cc], countryData, date);
        }

        // 날짜별로 모든 국가에대한 합산 데이터를 global 이라는 키값을 이용하여 저장
        if (!chartDataByCc['global']) {
            chartDataByCc['global'] = {
                date: [],
                confirmed: [],
                confirmedAcc: [],
                death: [],
                deathAcc: [],
                released: [],
                releasedAcc: [],
            };
        }

        const countryDataSum = countriesDataForOneDay.reduce(
            (sum, x) => ({
                confirmed: sum.confirmed + x.confirmed,
                death: sum.death + x.death,
                released: sum.released + (x.released || 0), // release 데이터가 없는 국가들이 존재
            }),
            { confirmed: 0, death: 0, released: 0 },
        );

        appendToChartData(chartDataByCc['global'], countryDataSum, date);
    }

    return chartDataByCc;
}

function appendToChartData(chartData, countryData, date) {
    // 전일 데이터가 없는 경우 현재 날짜 데이터를 그대로 사용
    if (chartData.date.length === 0) {
        chartData.confirmed.push(countryData.confirmed);
        chartData.death.push(countryData.death);
        chartData.released.push(countryData.released);
    } else {
        // 전일 대비 증가량을 저장
        const confirmedIncrement =
            countryData.confirmed - _.last(chartData.confirmedAcc) || 0;
        chartData.confirmed.push(confirmedIncrement);

        const deathIncrement = countryData.death - _.last(chartData.deathAcc) || 0;
        chartData.death.push(deathIncrement);

        const releasedIncrement =
            countryData.released - _.last(chartData.releasedAcc) || 0;
        chartData.released.push(releasedIncrement);
    }

    chartData.confirmedAcc.push(countryData.confirmed);
    chartData.deathAcc.push(countryData.death);
    chartData.releasedAcc.push(countryData.released);

    chartData.date.push(date);
}

module.exports = {
    getDataSource,
};