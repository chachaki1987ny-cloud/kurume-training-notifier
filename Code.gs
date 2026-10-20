/**
 * 久留米・告示研修 日程更新LINE通知システム
 *
 * 日本臨床工学技士会の告示研修日程ページを確認し、
 * 「久留米」を含む掲載情報に変更があった場合のみ
 * LINEグループへ通知します。
 *
 * LINE_GROUP_ID と LINE_CHANNEL_ACCESS_TOKEN は
 * Script Properties で管理します。
 */

function checkKuruScheduleChange() {
  const url = 'https://ja-ces.or.jp/kokuji-kenshu/nittei/';
  const properties = PropertiesService.getScriptProperties();

  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();

  if (status !== 200) {
    console.log('サイト取得失敗: HTTP ' + status);
    return;
  }

  const html = response.getContentText('UTF-8');

  // HTMLを表の行（<tr>）単位に分割
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  // 「久留米」を含む行だけを抽出
  const kurumeRows = rows
    .filter(function(row) {
      return row.includes('久留米');
    })
    .map(function(row) {
      // HTMLタグや余分な空白を除去し、比較しやすい形に整える
      return row
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    })
    .sort()
    .join('\n');

  // ページ構造変更などで情報を取得できなかった場合は
  // 保存済みデータを上書きしない
  if (!kurumeRows) {
    console.log(
      '久留米情報を取得できませんでした。基準データは変更しません。'
    );
    return;
  }

  const previous =
    properties.getProperty('KURUME_SCHEDULE_DATA');

  // 初回実行時は現在の情報を基準として保存
  if (previous === null) {
    properties.setProperty(
      'KURUME_SCHEDULE_DATA',
      kurumeRows
    );

    console.log('現在の久留米情報を基準として保存しました。');
    console.log('初回実行のためLINE通知は行いません。');
    return;
  }

  // 変更がなければ終了
  if (previous === kurumeRows) {
    console.log('久留米関連情報に変更はありません。');
    return;
  }

  // 変更があった場合のみLINEへ通知
  const sent = sendLineMessage(
    '【重要：久留米告示研修 更新検知】\n\n' +
    '告示研修の日程ページで、久留米関連情報の変更を検知しました。\n\n' +
    '新しい開催日・募集情報の可能性があります。' +
    '早めに公式サイトを確認してください。\n\n' +
    url
  );

  // LINE送信に成功した場合のみ、新しい状態を保存
  if (sent) {
    properties.setProperty(
      'KURUME_SCHEDULE_DATA',
      kurumeRows
    );

    console.log(
      'LINE通知に成功し、新しい久留米情報を保存しました。'
    );
  } else {
    console.log(
      'LINE通知に失敗したため、基準データは更新しません。'
    );
  }
}


function sendLineMessage(message) {
  const properties = PropertiesService.getScriptProperties();

  const groupId =
    properties.getProperty('LINE_GROUP_ID');

  const accessToken =
    properties.getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  if (!groupId || !accessToken) {
    console.log('LINEの認証情報が設定されていません。');
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

  const status = response.getResponseCode();

  console.log('LINE送信HTTP: ' + status);

  return status >= 200 && status < 300;
}
