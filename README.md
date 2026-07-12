# HEY HATCH LINEリッチメニュー設定

## ファイル
- `index.html`: 設定実行ページ
- `api/setup.js`: LINE Messaging APIで2枚のリッチメニューを登録
- `menu-home.png`: 1ページ目画像（自分で追加）
- `menu-services.png`: 2ページ目画像（自分で追加）

## Vercel環境変数
必須:
- `LINE_CHANNEL_ACCESS_TOKEN`
- `SETUP_KEY`
- `URL_LESSONS`
- `URL_REQUEST`
- `URL_MYPAGE`
- `URL_EVENTS`
- `URL_COMMUNITY`
- `URL_CERTIFIED`
- `URL_GUIDE`
- `URL_CONTACT`
- `URL_SERVICES`

## 実行
デプロイ後のトップページを開き、`SETUP_KEY`を入力して「LINEへ登録する」を押してください。

## 注意
Channel secretは不要です。アクセストークンをGitHubへ直接書かないでください。
