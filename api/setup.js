const API = 'https://api.line.me';
const DATA_API = 'https://api-data.line.me';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`環境変数 ${name} が未設定です`);
  return value;
}

async function lineFetch(path, options = {}) {
  const token = required('LINE_CHANNEL_ACCESS_TOKEN');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    throw new Error(`LINE API ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function deleteAliasIfExists(aliasId) {
  const response = await fetch(`${API}/v2/bot/richmenu/alias/${aliasId}`, {
    headers: { Authorization: `Bearer ${required('LINE_CHANNEL_ACCESS_TOKEN')}` }
  });
  if (response.status === 200) {
    await lineFetch(`/v2/bot/richmenu/alias/${aliasId}`, { method: 'DELETE' });
  } else if (response.status !== 404) {
    const body = await response.text();
    throw new Error(`エイリアス確認失敗 ${response.status}: ${body}`);
  }
}

async function deleteOldMenusByName(names) {
  const list = await lineFetch('/v2/bot/richmenu/list');
  for (const menu of (list.richmenus || [])) {
    if (names.includes(menu.name)) {
      await lineFetch(`/v2/bot/richmenu/${menu.richMenuId}`, { method: 'DELETE' });
    }
  }
}

async function createMenu(payload) {
  const result = await lineFetch('/v2/bot/richmenu', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify(payload)
  });
  return result.richMenuId;
}

async function uploadImage(richMenuId, imageUrl) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`画像取得失敗: ${imageUrl}`);
  const bytes = await imageResponse.arrayBuffer();
  const response = await fetch(`${DATA_API}/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${required('LINE_CHANNEL_ACCESS_TOKEN')}`,
      'content-type': 'image/png'
    },
    body: bytes
  });
  if (!response.ok) {
    throw new Error(`画像アップロード失敗 ${response.status}: ${await response.text()}`);
  }
}

function uri(label, value) {
  return { type: 'uri', label, uri: required(value) };
}

function switchMenu(label, aliasId, data) {
  return {
    type: 'richmenuswitch',
    label,
    richMenuAliasId: aliasId,
    data
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ok:false, message:'POSTのみ対応しています'});
  }

  try {
    if (!process.env.SETUP_KEY || req.body?.key !== process.env.SETUP_KEY) {
      return res.status(401).json({ok:false, message:'SETUP_KEYが違います'});
    }

    const origin = `https://${req.headers.host}`;
    const HOME_ALIAS = 'heyhatch-home';
    const SERVICES_ALIAS = 'heyhatch-services';
    const HOME_NAME = 'HEY HATCH HOME';
    const SERVICES_NAME = 'HEY HATCH SERVICES';

    await deleteAliasIfExists(HOME_ALIAS);
    await deleteAliasIfExists(SERVICES_ALIAS);
    await deleteOldMenusByName([HOME_NAME, SERVICES_NAME]);

    const homeMenu = {
      size: {width:2500, height:1686},
      selected: true,
      name: HOME_NAME,
      chatBarText: 'メニュー',
      areas: [
        {
          bounds: {x:1960, y:0, width:540, height:260},
          action: switchMenu('サービス一覧', SERVICES_ALIAS, 'switch-to-services')
        },
        {
          bounds: {x:0, y:820, width:833, height:720},
          action: uri('レッスンを探す', 'URL_LESSONS')
        },
        {
          bounds: {x:833, y:820, width:834, height:720},
          action: uri('リクエストする', 'URL_REQUEST')
        },
        {
          bounds: {x:1667, y:820, width:833, height:720},
          action: uri('マイページ', 'URL_MYPAGE')
        }
      ]
    };

    const servicesMenu = {
      size: {width:2500, height:1686},
      selected: true,
      name: SERVICES_NAME,
      chatBarText: 'メニュー',
      areas: [
        {
          bounds: {x:0, y:0, width:650, height:260},
          action: switchMenu('ホームに戻る', HOME_ALIAS, 'switch-to-home')
        },
        {
          bounds: {x:0, y:350, width:833, height:590},
          action: uri('イベント', 'URL_EVENTS')
        },
        {
          bounds: {x:833, y:350, width:834, height:590},
          action: uri('コミュニティ', 'URL_COMMUNITY')
        },
        {
          bounds: {x:1667, y:350, width:833, height:590},
          action: uri('認定トレーナー', 'URL_CERTIFIED')
        },
        {
          bounds: {x:0, y:940, width:833, height:590},
          action: uri('利用ガイド', 'URL_GUIDE')
        },
        {
          bounds: {x:833, y:940, width:834, height:590},
          action: uri('お問い合わせ', 'URL_CONTACT')
        },
        {
          bounds: {x:1667, y:940, width:833, height:590},
          action: uri('サービス紹介', 'URL_SERVICES')
        }
      ]
    };

    const homeId = await createMenu(homeMenu);
    const servicesId = await createMenu(servicesMenu);

    await uploadImage(homeId, `${origin}/menu-home.png`);
    await uploadImage(servicesId, `${origin}/menu-services.png`);

    await lineFetch('/v2/bot/richmenu/alias', {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({richMenuAliasId: HOME_ALIAS, richMenuId: homeId})
    });
    await lineFetch('/v2/bot/richmenu/alias', {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({richMenuAliasId: SERVICES_ALIAS, richMenuId: servicesId})
    });

    await lineFetch(`/v2/bot/user/all/richmenu/${homeId}`, {method:'POST'});

    return res.status(200).json({
      ok: true,
      message: '2ページ切り替えリッチメニューを登録しました',
      homeRichMenuId: homeId,
      servicesRichMenuId: servicesId,
      aliases: [HOME_ALIAS, SERVICES_ALIAS]
    });
  } catch (error) {
    return res.status(500).json({ok:false, message:error.message});
  }
}
