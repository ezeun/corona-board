const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

// Reference: https://developers.google.com/sheets/api/quickstart/nodejs
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']; // read & write permission
const TOKEN_PATH = 'accessToken.json';

class SheetApiClientFactory {
    static async create() {
        // 구글 OAuth 클라이언트 사용을 위해 credentials.json 파일 읽기
        const credential = fs.readFileSync('credentials.json');
        // 해당 파일을 이용해서 OAuth 인증 절차 진행
        const auth = await this._authorize(JSON.parse(credential));
        // 생성된 OAuth 클라이언트를 이용하여 구글 시트 API 클라이언트 생성
        return google.sheets({ version: 'v4', auth });
    }

    static async _authorize(credentials) {
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        // 구글 OAuth 클라이언트 초기화
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0],
        );

        // 기존에 발급받아둔 액세스 토큰이 없다면 새롭게 발급 요청
        if (!fs.existsSync(TOKEN_PATH)) {
            const token = await this._getNewToken(oAuth2Client);
            oAuth2Client.setCredentials(token);

            fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
            console.log('Token stored to', TOKEN_PATH);

            return oAuth2Client;
        }
        // 기존에 발급받아둔 액세스 토큰이 있으면 바로 사용
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        oAuth2Client.setCredentials(token);
        return oAuth2Client;
    }

    static async _getNewToken(oAuth2Client) {
        // OAuth 인증 진행을 위한 URL 생성
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        console.log('다음 URL을 브라우저에서 열어 인증을 진행하세요:', authUrl);

        // 터미널에서 키보드 입력 대기
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const code = await new Promise((resolve) => {
            rl.question(
                '인증이 완료되어 발급된 코드를 여기에 붙여넣으세요: ',
                (code) => {
                    resolve(code);
                },
            );
        });

        rl.close();

        // 인증 코드를 이용하여 액세스 토큰 발급
        const resp = await oAuth2Client.getToken(code);
        return resp.tokens;
    }
}

module.exports = SheetApiClientFactory;