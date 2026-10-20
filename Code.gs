/**
 * 久留米・告示研修 掲載監視システム
 *
 * 日本臨床工学技士会の告示研修日程ページを定期的に確認し、
 * 2027年2月20日・21日の久留米開催が掲載された場合に
 * LINEグループへ一度だけ通知します。
 *
 * また、公式ページを正常に監視できなくなった場合には、
 * 監視システムの異常としてLINE通知します。
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

  let response;

  // -----------------------------
  // 1. 公式サイトへアクセス
  // -----------------------------
  try {
    response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true
    });
  } catch (error) {
    handleMonitoringError(
      '公式サイトへのアクセスに失敗しました。',
      properties,
      url
    );
    return;
  }

  const status = response.getResponseCode();

  // HTTP 200以外
  if (status !== 200) {
    handleMonitoringError(
      '公式サイトを正常に取得できませんでした。\n' +
      'HTTPステータス: ' + status,
      properties,
      url
    );
    return;
  }

  const html =
    response.getContentText('UTF-8');

  // -----------------------------
  // 2. 日程表の構造を確認
  // -----------------------------
  const rows =
    html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  const hasScheduleStructure =
    rows.length >= 5 &&
    html.includes('開催日') &&
    html.includes('開催地') &&
    html.includes('会場');

  if (!hasScheduleStructure) {
    handleMonitoringError(
      '公式ページは取得できましたが、' +
      '日程表を正常に読み取れませんでした。\n' +
      'サイト構造が変更された可能性があります。',
      properties,
      url
    );
    return;
  }

  // ここまで正常なら、過去の異常状態を解除
  if (
    properties.getProperty(
      'KURUME_MONITOR_ERROR'
    ) === 'true'
  ) {
    properties.deleteProperty(
      'KURUME_MONITOR_ERROR'
    );

    console.log(
      '監視状態が正常に戻りました。'
    );
  }

  // -----------------------------
  // 3. 対象の久留米開催を検索
  // -----------------------------
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
    '日程表の行数: ' + rows.length
  );

  console.log(
    '対象の久留米開催情報: ' + found
  );

  console.log(
    '該当行数: ' + targetRows.length
  );

  // まだ掲載されていない
  if (!found) {
    console.log(
      '2027年2月20日・21日の久留米開催は、' +
      'まだ確認できません。'
    );
    return;
  }

  // -----------------------------
  // 4. 通知済みか確認
  // -----------------------------
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

  // -----------------------------
  // 5. 対象情報をLINE通知
  // -----------------------------
  const sent = sendLineMessage(
    '【久留米告示研修 掲載確認】\n\n' +
    '2027年2月20日・21日の久留米開催が、' +
    '公式日程ページに掲載された可能性があります。\n\n' +
    '予約受付が開始されている可能性がありますので、' +
    'ログインして予約画面を確認してください。\n\n' +
    url
  );

  // 成功時のみ通知済みとして保存
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
    console.log(
      'LINE通知に失敗しました。' +
      '次回の定期実行で再試行します。'
    );
  }
}


/**
 * 監視異常を処理する
 */
function handleMonitoringError(
  errorMessage,
  properties,
  url
) {

  console.log(
    '監視異常: ' + errorMessage
  );

  const alreadyNotified =
    properties.getProperty(
      'KURUME_MONITOR_ERROR'
    );

  // 同じ異常状態については繰り返し通知しない
  if (alreadyNotified === 'true') {
    console.log(
      '監視異常はすでに通知済みです。'
    );
    return;
  }

  const sent = sendLineMessage(
    '【告示研修 監視システム異常】\n\n' +
    errorMessage + '\n\n' +
    'サイト構造変更または一時的な障害の可能性があります。\n' +
    '念のため公式サイトを手動で確認してください。\n\n' +
    url
  );

  // LINE通知成功時だけ異常通知済みにする
  if (sent) {
    properties.setProperty(
      'KURUME_MONITOR_ERROR',
      'true'
    );

    console.log(
      '監視異常をLINE通知しました。'
    );
  } else {
    console.log(
      '異常通知のLINE送信に失敗しました。' +
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

  return status >= 200 && status < 300;
}
