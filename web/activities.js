'use strict'

/**
 * 六事展開說明的內容：小故事、八卦性質與循環動畫（inline SVG，配色走 CSS 色票）。
 * 純介面內容，不影響評分邏輯。
 */

/** 每件事在三種評等下的小故事，主角是工程師「小易」 */
export const STORIES = {
  '開會': {
    good: '小易帶著一頁簡報走進會議室，十分鐘講完重點，主管點頭、同事補了兩個好點子，散會前分工就定好了。今天適合把卡住的議題端上桌。',
    fair: '會議照議程走，討論到一半有人丟出新議題，小易說「這個我們會後另開」，準時散會，不多也不少。守住議程就好。',
    bad: '原本半小時的會，因為兩派意見僵持拖到午餐，結論是「下週再開一次」。小易嘆口氣：早知道先寫成文件讓大家留言。今天能不開就不開。',
  },
  '撰寫報告': {
    good: '小易泡了杯茶，大綱一列好，段落就像自己流出來。下班前報告已經校對完，還多畫了一張圖。思路清楚的日子，別浪費。',
    fair: '報告寫到第三段卡住，小易先跳去寫結論，回頭再補中間。一段一段完成，不快，但穩穩交出。',
    bad: '小易盯著游標閃了一小時，寫了又刪、刪了又寫。最後他先把資料整理成條列，決定明早頭腦清楚再動筆。今天先蒐集，別硬寫。',
  },
  '抓BUG': {
    good: '錯誤只在週三下午出現，小易看了一眼 log，直覺鎖定時區轉換。改一行，測試全綠。今天的直覺特別準，放心追下去。',
    fair: '小易照步驟重現問題，用二分法一半一半排除，第七次終於找到元兇：一個沒處理的空值。慢，但每一步都算數。',
    bad: '修好一個 bug，冒出兩個新的；再修，又冒出三個。小易停下來把現象寫成筆記，拉同事一起看，才發現一開始就修錯地方。今天別單打獨鬥。',
  },
  '系統開發': {
    good: '新功能的架構圖一畫就順，介面一致、模組分明。小易寫下第一個測試，一路寫到收工，程式碼乾淨得想裱起來。',
    fair: '小易把大功能切成五個小步驟，每完成一步就提交、跑測試。進度不驚人，但每一步都踩得穩。',
    bad: '小易想一口氣重構整個模組，改到一半發現牽一髮動全身，只好全部還原。今天先把設計寫在紙上，動手留給明天。',
  },
  '程式上線': {
    good: '檢查清單一項項打勾，部署按下去，監控曲線平穩如湖面。小易在群組貼出「已上線」，順便準時下班。時機成熟，放心發布。',
    fair: '上線時跳出一個小警告，小易照回滾計畫先暫停，確認只是設定延遲，十分鐘後順利完成。可以上，但要備好退路。',
    bad: '週五傍晚，小易按下部署，監控圖瞬間一片紅。回滾、道歉、加班到深夜，隔天才發現只是設定檔少了一行。今天能延就延。',
  },
  '餵魚/澆花': {
    good: '午休時小易給窗邊的盆栽澆水，魚缸裡的小金魚游過來討食。看著水面一圈圈漣漪，卡住的難題突然鬆開了。',
    fair: '小易照例在下午三點餵魚、澆花，沒什麼特別，就是日常的小儀式。順手換個水，讓牠們也舒服一點。',
    bad: '小易忙到忘了澆花，想起來一口氣倒了半壺水，盆栽淹水、飼料也撒了一桌。設個鬧鐘，少量多次就好。',
  },
}

/** 八卦性質，以三位碼為索引 */
export const TRAITS = ['柔順承載', '發動開創', '險陷深入', '喜悅言說', '止靜', '光明清晰', '滲透溝通', '剛健主導']

/** 八卦傾向值（0–100）對某件事的影響 */
export function relation(v) {
  if (v >= 80) return '大有助益'
  if (v >= 60) return '有幫助'
  if (v > 40) return '影響不大'
  if (v > 20) return '略有阻力'
  return '阻力很大'
}

const KOI = `
  <path class="ink" d="M16 0 C10 -7 -4 -8 -12 0 C-4 8 10 7 16 0 Z"/>
  <path class="ink koi-tail" d="M-11 0 L-21 -7 Q-18 0 -21 7 Z"/>
  <circle class="acc-fill" cx="3" cy="-1" r="3"/>
  <circle class="paper" cx="11" cy="-2" r="1"/>`

const LANTERN = `
  <circle class="acc-fill glow" r="24"/>
  <path class="acc-fill" d="M-11 -15 Q0 -19 11 -15 L8 13 Q0 16 -8 13 Z"/>
  <path class="rib" d="M-4 -16 L-3 14 M4 -16 L3 14"/>
  <circle class="flame" cy="17" r="2.2"/>`

/** 各活動的循環動畫，viewBox 240×150 */
export const SCENES = {
  '開會': `
    <svg class="scene scene-meet" viewBox="0 0 240 150" role="img" aria-label="會議桌旁，四人輪流發言">
      <g class="p p1"><circle class="ink head" cx="76" cy="52" r="8"/><path class="ink" d="M62 74 Q76 58 90 74 Z"/></g>
      <g class="p p2"><circle class="ink head" cx="164" cy="52" r="8"/><path class="ink" d="M150 74 Q164 58 178 74 Z"/></g>
      <g class="p p3"><circle class="ink head" cx="40" cy="90" r="8"/><path class="ink" d="M26 112 Q40 96 54 112 Z"/></g>
      <g class="p p4"><circle class="ink head" cx="200" cy="90" r="8"/><path class="ink" d="M186 112 Q200 96 214 112 Z"/></g>
      <ellipse class="wash" cx="120" cy="100" rx="62" ry="24"/>
      <ellipse class="line" cx="120" cy="100" rx="62" ry="24"/>
      <rect class="line" x="98" y="94" width="18" height="11" rx="1"/>
      <circle class="line" cx="144" cy="100" r="4"/>
      <g class="bubble b1"><rect class="paper line" x="60" y="12" width="34" height="20" rx="6"/><path class="paper line" d="M72 32 l4 6 l3 -6"/><circle class="ink" cx="69" cy="22" r="2"/><circle class="ink" cx="77" cy="22" r="2"/><circle class="ink" cx="85" cy="22" r="2"/></g>
      <g class="bubble b2"><rect class="paper line" x="148" y="12" width="34" height="20" rx="6"/><path class="paper line" d="M160 32 l4 6 l3 -6"/><circle class="ink" cx="157" cy="22" r="2"/><circle class="ink" cx="165" cy="22" r="2"/><circle class="ink" cx="173" cy="22" r="2"/></g>
      <g class="bubble b3"><rect class="paper line" x="24" y="50" width="34" height="20" rx="6"/><path class="paper line" d="M36 70 l4 6 l3 -6"/><circle class="ink" cx="33" cy="60" r="2"/><circle class="ink" cx="41" cy="60" r="2"/><circle class="ink" cx="49" cy="60" r="2"/></g>
      <g class="bubble b4"><rect class="paper line" x="182" y="50" width="34" height="20" rx="6"/><path class="paper line" d="M194 70 l4 6 l3 -6"/><circle class="ink" cx="191" cy="60" r="2"/><circle class="ink" cx="199" cy="60" r="2"/><circle class="ink" cx="207" cy="60" r="2"/></g>
    </svg>`,

  '撰寫報告': `
    <svg class="scene scene-write" viewBox="0 0 240 150" role="img" aria-label="毛筆在紙上逐行書寫">
      <g class="cycle">
        <path class="paper line" d="M70 14 H154 L170 30 V136 H70 Z"/>
        <path class="line" d="M154 14 V30 H170"/>
        <path class="w w0 title" pathLength="1" d="M84 40 H136"/>
        <path class="w w1" pathLength="1" d="M84 60 H156"/>
        <path class="w w2" pathLength="1" d="M84 76 H150"/>
        <path class="w w3" pathLength="1" d="M84 92 H156"/>
        <path class="w w4" pathLength="1" d="M84 108 H146"/>
        <path class="w w5" pathLength="1" d="M84 124 H120"/>
        <g class="pen"><path class="ink" d="M0 0 L5 -12 L9 -10 Z"/><path class="line" d="M7 -11 L17 -32"/></g>
      </g>
    </svg>`,

  '抓BUG': `
    <svg class="scene scene-bug" viewBox="0 0 240 150" role="img" aria-label="放大鏡在程式碼中追到一隻蟲">
      <path class="code" d="M28 28 H64 M72 28 H112 M40 46 H96 M104 46 H124 M40 64 H80 M52 82 H120 M52 100 H88 M96 100 H132 M40 118 H76 M28 136 H52"/>
      <g class="bug">
        <path class="line thin" d="M-5 -3 L-10 -6 M-5 1 L-11 1 M-5 5 L-10 9 M5 -3 L10 -6 M5 1 L11 1 M5 5 L10 9 M-2 -11 L-5 -16 M2 -11 L5 -16"/>
        <ellipse class="ink" rx="5" ry="7"/>
        <circle class="ink" cy="-9" r="3"/>
      </g>
      <path class="check" pathLength="1" d="M104 82 l6 6 l12 -14"/>
      <g class="lens">
        <circle class="wash line" r="17"/>
        <path class="line" d="M-9 -7 A11 11 0 0 1 -2 -11"/>
        <path class="handle" d="M12 12 L28 28"/>
      </g>
    </svg>`,

  '系統開發': `
    <svg class="scene scene-build" viewBox="0 0 240 150" role="img" aria-label="積木一塊塊堆成樓閣">
      <path class="line" d="M40 135 H200"/>
      <g class="cycle">
        <rect class="blk k0 paper line" x="62" y="112" width="38" height="22" rx="1"/>
        <rect class="blk k1 paper line" x="101" y="112" width="38" height="22" rx="1"/>
        <rect class="blk k2 paper line" x="140" y="112" width="38" height="22" rx="1"/>
        <rect class="blk k3 paper line" x="81" y="89" width="38" height="22" rx="1"/>
        <rect class="blk k4 paper line" x="120" y="89" width="38" height="22" rx="1"/>
        <rect class="blk k5 paper line" x="100.5" y="66" width="38" height="22" rx="1"/>
        <path class="roof" pathLength="1" d="M90 64 L119.5 44 L149 64 M119.5 44 V34"/>
      </g>
    </svg>`,

  '程式上線': `
    <svg class="scene scene-launch" viewBox="0 0 240 150" role="img" aria-label="天燈從山間冉冉升起">
      <path class="wash" d="M0 150 V128 Q40 108 80 122 T160 116 T240 124 V150 Z"/>
      <path class="line faint-line" d="M0 128 Q40 108 80 122 T160 116 T240 124"/>
      <g transform="translate(70 132) scale(0.62)"><g class="lantern l2">${LANTERN}</g></g>
      <g transform="translate(176 128) scale(0.75)"><g class="lantern l3">${LANTERN}</g></g>
      <g transform="translate(120 120)"><g class="lantern l1">${LANTERN}</g></g>
      <circle class="spark s1" cx="104" cy="110" r="1.4"/>
      <circle class="spark s2" cx="136" cy="116" r="1.2"/>
      <circle class="spark s3" cx="160" cy="112" r="1.4"/>
    </svg>`,

  '餵魚/澆花': `
    <svg class="scene scene-pond" viewBox="0 0 240 150" role="img" aria-label="錦鯉在池中繞游，飼料落下泛起漣漪">
      <circle class="wash line" cx="120" cy="76" r="60"/>
      <circle class="leaf" cx="162" cy="114" r="13"/>
      <path class="line" d="M162 114 L172 106"/>
      <circle class="ripple r1" cx="104" cy="52" r="5"/>
      <circle class="ripple r2" cx="138" cy="62" r="5"/>
      <circle class="ripple r3" cx="122" cy="44" r="5"/>
      <g class="orbit o1"><g transform="translate(120 34)">${KOI}</g></g>
      <g class="orbit o2"><g transform="translate(120 100) scale(-0.75 0.75)">${KOI}</g></g>
      <circle class="food f1 ink" cx="104" cy="52" r="1.8"/>
      <circle class="food f2 ink" cx="138" cy="62" r="1.8"/>
      <circle class="food f3 ink" cx="122" cy="44" r="1.8"/>
    </svg>`,
}
