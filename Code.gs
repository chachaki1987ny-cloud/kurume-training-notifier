/**
 * 久留米・告示研修 掲載監視システム
 *
 * 日本臨床工学技士会の告示研修日程ページを定期的に確認し、
 * 2027年2月20日・21日の久留米開催が掲載された場合に
 * LINEグループへ一度だけ通知します。
 *
 * LINE_GROUP_ID と LINE_CHANNEL_ACCESS_TOKEN は
 * Script Properties で管理します。
 */


/**
 * メイン監視処理
 */
function checkKuruScheduleChange() {
  const url =
    'https://ja-ces.or.jp/kokuji-kenshu/nittei/';

  const properties =
    PropertiesService.getScriptProperties();

  // 公式サイトを取得
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();

  // サイト取得に失敗した場合は終了
  if (status !== 200) {
    console.log(
      'サイト取得失敗: HTTP ' + status
    );
    return;
  }

  const html =
    response.getContentText('UTF-8');

  // HTMLを表の行 <tr> ごとに分割
  const rows =
    html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  // 「久留米」＋「2月20日または2月21日」
  // が含まれる行を探す
  const targetRows = rows.filter(function(row) {

    const text = row
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const hasKurume =
      text.includes('久留米');

    const hasFeb20 =
      text.includes('2月20日') ||
      text.includes('2/20');

    const hasFeb21 =
      text.includes('2月21日') ||
      text.includes('2/21');

    return (
      hasKurume &&
      (hasFeb20 || hasFeb21)
    );
  });

  const found =
    targetRows.length > 0;

  console.log(
    '対象の久留米開催情報: ' + found
  );

  console.log(
    '該当行数: ' + targetRows.length
  );

  // まだ公式ページに掲載されていない
  if (!found) {
    console.log(
      '2027年2月20日・21日の久留米開催は、' +
      'まだ確認できません。'
    );
    return;
  }

  // すでに通知済みか確認
  const notified =
    properties.getProperty(
      'KURUME_2027_0220_NOTIFIED'
    );

  if (notified === 'true') {
    console.log(
      'すでにLINE通知済みです。'
    );
    return;
  }

  // 初めて対象情報を確認した場合のみLINE通知
  const sent = sendLineMessage(
    '【久留米告示研修 掲載確認】\n\n' +
    '2027年2月20日・21日の久留米開催が、' +
    '公式日程ページに掲載された可能性があります。\n\n' +
    '予約受付が開始されている可能性がありますので、' +
    'ログインして予約画面を確認してください。\n\n' +
    url
  );

  // LINE送信成功時のみ通知済みとして保存
  if (sent) {

    properties.setProperty(
      'KURUME_2027_0220_NOTIFIED',
      'true'
    );

    console.log(
      'LINE通知に成功しました。' +
      '通知済みとして保存しました。'
    );

  } else {

    // 失敗時は保存せず、次回の定期実行で再試行
    console.log(
      'LINE通知に失敗しました。' +
      '通知済みにはしていません。' +
      '次回再試行します。'
    );
  }
}


/**
 * LINEへメッセージを送信
 *
 * 成功 → true
 * 失敗 → false
 */
function sendLineMessage(message) {
  const properties =
    PropertiesService.getScriptProperties();

  const groupId =
    properties.getProperty('LINE_GROUP_ID');

  const accessToken =
    properties.getProperty(
      'LINE_CHANNEL_ACCESS_TOKEN'
    );

  // LINE設定が不足している場合は送信しない
  if (!groupId || !accessToken) {
    console.log(
      'LINEの認証情報が設定されていません。'
    );
    return false;
  }

  const payload = {
    to: groupId,
    messages: [
      {
        type: 'text',
        text: message
      }
    ]
  };

  const response = UrlFetchApp.fetch(
    'https://api.line.me/v2/bot/message/push',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const status =
    response.getResponseCode();

  console.log(
    'LINE送信HTTP: ' + status
  );

  // HTTP 200番台なら送信成功
  return status >= 200 && status < 300;
}
