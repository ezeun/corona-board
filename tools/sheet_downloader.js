const fs = require('fs');
const path = require('path');

class SheetDownloader {
    constructor(apiClient) {
        this.apiClient = apiClient;
    }

    /**
     * 명시한 스프레드시트의 시트 내용을 읽어 JSON 객체로 변환해줍니다.
     * @param spreadsheetId 스프레드시트 ID
     * @param sheetName 시트 이름
     * @param filePath 저장할 JSON 파일 생략 시 파일로 저장하지 않음
     */
    async downloadToJson(spreadsheetId, sheetName, filePath = null) {
        // 명시한 시트의 내용을 가져옵니다.
        const res = await this.apiClient.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: sheetName,
        });

        // 행 데이터(배열)를 얻어옵니다.
        const rows = res.data.values;

        // 행이 0개라면, 즉 시트에 아무런 데이터가 없다면 빈 JSON 객체를 반환합니다.
        if (rows.length === 0) {
            const message = 'No data found on the sheet';
            console.error(message);
            return {};
        }

        // 행 데이터(배열)를 객체로 반환합니다.
        const object = this._rowsToObject(rows);

        // filePath를 명시했다면 지정한 파일로 저장
        if (filePath) {
            // 마지막 인수는 space를 의미합니다. 이곳에 2를 넣으면
            // 출력되는 JSON 문자열에 2칸 들여쓰기와 줄바꿈이 적용되어 보기 편해집니다.
            const jsonText = JSON.stringify(object, null, 2);

            const directory = path.dirname(filePath);
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory);
            }
            fs.writeFileSync(filePath, jsonText);
            console.log(`Written to ${filePath}`);
        }
        return object;
    }

    /**
     * 주어진 배열을 JSON 객체로 변환해줍니다.
     * @param rows 변환할 2차원 배열 
     */
    _rowsToObject(rows) {
        const headerRow = rows.slice(0, 1)[0];
        const dataRows = rows.slice(1, rows.length);

        return dataRows.map((row) => {
            const item = {};
            for (let i = 0; i < headerRow.length; i++) { // 열(제목) 수만큼 반복
                const fieldName = headerRow[i]; // 키(열 제목)
                const fieldValue = row[i]; // 값(내용)
                item[fieldName] = fieldValue;
            }
            return item;
        });
    }
}

module.exports = SheetDownloader;