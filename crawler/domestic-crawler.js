const _ = require('lodash'); // 다양한 유틸리티 함수 제공
const axios = require('axios'); // HTTP 클라이언트 모듈
const cheerio = require('cheerio'); // HTML 파싱 및 DOM 생성

class DomesticCrawler {
    constructor() {
        this.client = axios.create({
            // 실제 크롬 웹브라우저에서 보내는 값과 동일하게 넣기
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
            },
        });
    }

    // 크롤링 수행
    async crawlStat() {
        // 공식 사이트 '발생동향 > 국내 발생 현황' 페이지의 주소
        // http://ncov.mohw.go.kr/bdBoardList_Real.do?brdId=1&brdGubun=11&ncvContSeq=&contSeq=&board_id=&gubun=
        // 클론 사이트 주소
        const url = 'https://yjiq150.github.io/coronaboard-crawling-sample/clone/ncov/';
        const resp = await this.client.get(url);
        const $ = cheerio.load(resp.data);

        return {
            // 확진자, 사망자, 격리해제, 검사중, 결과음성, 총 검사자 수
            basicStats: this._extractBasicStats($),
            byAge: this._extractByAge($), // 나이에 따른 확진자, 사망자 수
            bySex: this._extractBySex($), // 성별에 따른 확진자, 사망자 수
        };
    }

    _extractBasicStats($) {
        let result = null;
        const titles = $('h5.s_title_in3');
        titles.each((i, el) => {
            // h5 태그 안에 span 태그(업데이트 날짜 표시)와 텍스트(제목)가 섞여있는 경우가 존재함
            // 여기서 태그를 제외하고 순수 텍스트만 분리
            const titleTextEl = $(el)
                .contents() // 요소 서브의 텍스트 노드를 포함한 모든 노드 반환
                .toArray()
                .filter((x) => x.type === 'text');

            // 제목이 '누적 검사현황' 다음에 나오는 테이블을 찾는다
            if ($(titleTextEl).text().trim() === '누적 검사현황') {
                const tableEl = $(el).next();
                if (!tableEl) {
                    throw new Error('table not found.');
                }
                // 테이블 내의 셀을 모두 찾아서 가져온다
                const cellEls = tableEl.find('tbody tr td');

                // 찾아진 셀에 있는 텍스트를 읽어서 숫자로 변환한다.
                const values = cellEls
                    .toArray()
                    .map((node) => this._normalize($(node).text()));

                result = {
                    confirmed: values[3],
                    released: values[1],
                    death: values[2],
                    tested: values[5],
                    testing: values[6],
                    negative: values[4],
                };
            }
        });

        if (result == null) {
            throw new Error('Data not found');
        }

        return result;
    }

    _extractByAge($) {
        // '구분' 컬럼의 텍스트를 필드 이름으로 매핑
        const mapping = {
            '80 이상': '80',
            '70-79': '70',
            '60-69': '60',
            '50-59': '50',
            '40-49': '40',
            '30-39': '30',
            '20-29': '20',
            '10-19': '10',
            '0-9': '0',
        };

        return this._extractDataWithMapping(mapping, $);
    }

    _extractBySex($) {
        const mapping = {
            남성: 'male',
            여성: 'female',
        };

        return this._extractDataWithMapping(mapping, $);
    }

    _extractDataWithMapping(mapping, $) {
        const result = {};

        $('.data_table table').each((i, el) => {
            $(el)
                .find('tbody tr')
                .each((j, row) => {
                    const cols = $(row).children(); // 서브 요소를 모두 가져옴
                    _.forEach(mapping, (fieldName, firstColumnText) => {
                        // 현재 행의 첫 번째 컬럼값이 mapping에 정의된 이름과
                        // 동일한 경우에만 데이터 추출
                        if ($(cols.get(0)).text() === firstColumnText) {
                            result[fieldName] = {
                                confirmed: this._normalize($(cols.get(1)).text()),
                                death: this._normalize($(cols.get(2)).text()),
                            };
                        }
                    });
                });
        });

        if (_.isEmpty(result)) {
            throw new Error('data not found');
        }

        return result;
    }

    // 텍스트로된 숫자를 실제 수치로 변환
    _normalize(numberText) {
        // 아래 형태로 들어올 때 괄호 없는 앞쪽 숫자만 추출
        // ex) 8,757 (45.14)
        const matches = /[0-9,]+/.exec(numberText);
        const absValue = matches[0];
        return parseInt(absValue.replace(/[\s,]*/g, ''));
    }
}

module.exports = DomesticCrawler;