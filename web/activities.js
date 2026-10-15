'use strict'

/**
 * 問事各事項的內容：提醒、小故事、印章、代表字與八卦性質。
 * 純介面內容，不影響評分邏輯。
 */

/**
 * 事項池：cats 為 [主分類, 副分類]（六類見 core-spec「事項評分」），glyph 為循環動畫聚成的代表字，
 * tips／stories 為三種評等的提醒與小故事（主角是「小易」）。
 * 印章彩蛋（可省略）：low 分數低於 10、high 90 分以上、friday／monday 主分類套用了週五／週一規則。
 * 代號會存進紀錄與分享碼，只能用小寫英文字母，且不可更改。
 */
export const ITEMS = {
  meeting: {
    name: '開會', cats: [0, 3], glyph: '會',
    monday: '週一症候群',
    tips: { good: '宜主動發言、拍板定案，共識來得快。', fair: '照議程走，避免臨時加題。', bad: '能改用文字溝通就別開，開了也易各說各話。' },
    stories: {
      good: '小易帶著一頁簡報走進會議室，十分鐘講完重點，主管點頭、同事補了兩個好點子，散會前分工就定好了。今天適合把卡住的議題端上桌。',
      fair: '會議照議程走，討論到一半有人丟出新議題，小易說「這個我們會後另開」，準時散會，不多也不少。守住議程就好。',
      bad: '原本半小時的會，因為兩派意見僵持拖到午餐，結論是「下週再開一次」。小易嘆口氣：早知道先寫成文件讓大家留言。今天能不開就不開。',
    },
  },
  report: {
    name: '撰寫報告', cats: [1, 2], glyph: '文',
    tips: { good: '思路清晰，一氣呵成的好時機。', fair: '先列大綱再填內容，分段完成。', bad: '易卡文或寫偏，先蒐集資料，明天再修。' },
    stories: {
      good: '小易泡了杯茶，大綱一列好，段落就像自己流出來。下班前報告已經校對完，還多畫了一張圖。思路清楚的日子，別浪費。',
      fair: '報告寫到第三段卡住，小易先跳去寫結論，回頭再補中間。一段一段完成，不快，但穩穩交出。',
      bad: '小易盯著游標閃了一小時，寫了又刪、刪了又寫。最後他先把資料整理成條列，決定明早頭腦清楚再動筆。今天先蒐集，別硬寫。',
    },
  },
  debug: {
    name: '抓BUG', cats: [1, 4], glyph: '蟲',
    high: '除錯之神',
    tips: { good: '直覺敏銳，追根究柢容易找到病灶。', fair: '照步驟重現、二分排查，耐心是關鍵。', bad: '容易越修越亂，先記錄現象、找人一起看。' },
    stories: {
      good: '錯誤只在週三下午出現，小易看了一眼 log，直覺鎖定時區轉換。改一行，測試全綠。今天的直覺特別準，放心追下去。',
      fair: '小易照步驟重現問題，用二分法一半一半排除，第七次終於找到元兇：一個沒處理的空值。慢，但每一步都算數。',
      bad: '修好一個 bug，冒出兩個新的；再修，又冒出三個。小易停下來把現象寫成筆記，拉同事一起看，才發現一開始就修錯地方。今天別單打獨鬥。',
    },
  },
  develop: {
    name: '系統開發', cats: [2, 1], glyph: '造',
    high: '神來一筆',
    tips: { good: '適合開新功能、做架構設計。', fair: '以小步提交為主，邊做邊測。', bad: '不宜大改架構，先做規劃與文件。' },
    stories: {
      good: '新功能的架構圖一畫就順，介面一致、模組分明。小易寫下第一個測試，一路寫到收工，程式碼乾淨得想裱起來。',
      fair: '小易把大功能切成五個小步驟，每完成一步就提交、跑測試。進度不驚人，但每一步都踩得穩。',
      bad: '小易想一口氣重構整個模組，改到一半發現牽一髮動全身，只好全部還原。今天先把設計寫在紙上，動手留給明天。',
    },
  },
  deploy: {
    name: '程式上線', cats: [4, 3], glyph: '發',
    low: '封版', friday: '週五不部署',
    tips: { good: '時機成熟，照檢查清單穩穩發布。', fair: '可以上線，但先確認回滾方案。', bad: '能延則延；非上不可就縮小範圍、全程盯監控。' },
    stories: {
      good: '檢查清單一項項打勾，部署按下去，監控曲線平穩如湖面。小易在群組貼出「已上線」，順便準時下班。時機成熟，放心發布。',
      fair: '上線時跳出一個小警告，小易照回滾計畫先暫停，確認只是設定延遲，十分鐘後順利完成。可以上，但要備好退路。',
      bad: '週五傍晚，小易按下部署，監控圖瞬間一片紅。回滾、道歉、加班到深夜，隔天才發現只是設定檔少了一行。今天能延就延。',
    },
  },
  fish: {
    name: '餵魚/澆花', cats: [5, 3], glyph: '魚',
    tips: { good: '生活小事做起來特別療癒，順便放空。', fair: '記得就好，別忘了換水。', bad: '容易忘記或手滑，設個提醒吧。' },
    stories: {
      good: '午休時小易給窗邊的盆栽澆水，魚缸裡的小金魚游過來討食。看著水面一圈圈漣漪，卡住的難題突然鬆開了。',
      fair: '小易照例在下午三點餵魚、澆花，沒什麼特別，就是日常的小儀式。順手換個水，讓牠們也舒服一點。',
      bad: '小易忙到忘了澆花，想起來一口氣倒了半壺水，盆栽淹水、飼料也撒了一桌。設個鬧鐘，少量多次就好。',
    },
  },
  memo: {
    name: '寫公文', cats: [3, 1], glyph: '公',
    tips: { good: '文思通順，公文一次過關。', fair: '照範本走，格式先對齊。', bad: '容易寫錯字或漏附件，送出前多看一遍。' },
    stories: {
      good: '小易打開公文範本，主旨、說明、辦法一氣呵成，主管只改了一個標點就蓋章。今天寫什麼都順。',
      fair: '小易照著去年的範本改，邊寫邊查條文，雖然慢了點，下班前也送出去了。',
      bad: '公文送出三分鐘就被退回：附件忘了附，日期還寫成去年。小易決定明天早上精神好再重寫一次。',
    },
  },
  reimburse: {
    name: '核對報帳', cats: [1, 3], glyph: '帳',
    high: '一分不差',
    tips: { good: '眼明手快，帳一對就平。', fair: '一張一張對，慢慢來比較快。', bad: '容易看錯數字，先放著，找人覆核。' },
    stories: {
      good: '一疊發票在小易手上像在變魔術，十分鐘對完，一塊錢都沒差。會計說：「你今天是計算機嗎？」',
      fair: '小易把發票按日期排好，一張張登打，中途對不起來，回頭找到一張重複的，總算平了。',
      bad: '差了 37 元，小易翻了整個下午還是找不到，最後發現是自己的便當收據混進去了。',
    },
  },
  schedule: {
    name: '排行程', cats: [3, 0], glyph: '程',
    tips: { good: '時間一排就順，適合規劃下週。', fair: '先排重要的，留點緩衝。', bad: '容易撞期，排完請對方再確認一次。' },
    stories: {
      good: '三個部門、五位主管的會議，小易一次就找到大家都有空的時段，連會議室都順利借到。',
      fair: '小易排好行程表，臨時有人請假，挪了兩格還是排進去了。留緩衝果然有用。',
      bad: '小易排好的會議跟董事長的行程撞期，全部重排；第二版又撞上國定假日。今天排完記得再看一次日曆。',
    },
  },
  approval: {
    name: '送簽呈', cats: [4, 0], glyph: '簽',
    low: '退件', friday: '主管不在',
    tips: { good: '時機成熟，送上去很快就會批。', fair: '可以送，先把理由寫清楚。', bad: '容易被退件，能等就等主管心情好的時候。' },
    stories: {
      good: '小易早上九點送出簽呈，十點就批回來了，主管還加了一句「辦得好」。今天想推的案子快送。',
      fair: '簽呈送上去，主管問了兩個問題，小易補了說明，隔天才批。可以送，但資料要備齊。',
      bad: '簽呈在主管桌上躺了三天，退回來時多了一張便條：「再研議」。小易決定換個時機再送。',
    },
  },
  teatime: {
    name: '午茶摸魚', cats: [5, 0], glyph: '茶',
    tips: { good: '下午茶時間到，喘口氣反而效率更好。', fair: '小歇一下就好，別聊太久。', bad: '今天摸魚容易被抓，休息要光明正大。' },
    stories: {
      good: '三點，同事揪團買手搖飲，小易點了半糖微冰，聊著聊著，下午卡住的流程就有了解法。',
      fair: '小易泡了杯茶，在茶水間站了五分鐘，回座位繼續工作，精神好了一些。',
      bad: '小易剛點開購物網站，主管就從背後經過。今天想休息，就大方去茶水間倒杯水吧。',
    },
  },
  group: {
    name: '小組討論', cats: [0, 2], glyph: '群',
    monday: '週一沒人回',
    tips: { good: '大家意見很合，分工一次搞定。', fair: '先訂好議題，避免聊到離題。', bad: '容易各說各話，先在群組把重點打出來。' },
    stories: {
      good: '小組討論只花了二十分鐘，題目定了、分工排好，還有人自願做簡報。小易覺得這組穩了。',
      fair: '討論到一半大家開始聊八卦，小易把話題拉回來，最後勉強把分工定下來。',
      bad: '四個人約討論，兩個遲到、一個在打電動，討論變成閒聊。小易決定回去在群組直接分工。',
    },
  },
  homework: {
    name: '寫作業', cats: [3, 1], glyph: '習',
    tips: { good: '腦袋清楚，一口氣寫完的好時機。', fair: '分段寫，寫一題休息一下。', bad: '容易卡關，先看範例或問同學。' },
    stories: {
      good: '小易打開作業，題目一看就懂，晚餐前就寫完了，還有時間預習明天的課。',
      fair: '作業寫到第三題卡住，小易先跳過，寫完其他題再回來，總算在睡前完成。',
      bad: '小易盯著題目半小時，寫了又擦、擦了又寫，最後問了同學才發現自己看錯題目。',
    },
  },
  exam: {
    name: '考試', cats: [1, 4], glyph: '考',
    high: '金榜題名',
    tips: { good: '思路清晰，會的都能寫對。', fair: '先寫會的，難題留到最後。', bad: '容易粗心，交卷前檢查一遍。' },
    stories: {
      good: '考卷一發下來，小易發現昨晚複習的全都考了，寫完還有二十分鐘可以檢查。',
      fair: '前半段很順，後面兩題沒把握，小易先寫會的，最後再回頭推敲，寫得七七八八。',
      bad: '小易寫得很順，交卷後才發現背面還有一大題沒寫。今天考試記得翻面。',
    },
  },
  project: {
    name: '做專題', cats: [2, 3], glyph: '題',
    tips: { good: '適合動手做，把架構搭起來。', fair: '小步推進，每天做一點。', bad: '不宜大改方向，先把計畫寫清楚。' },
    stories: {
      good: '小易把專題拆成五個部分，今天一口氣做完兩個，指導老師說進度超前。',
      fair: '小易每天做一點，今天把資料整理好，雖然沒有大進展，但方向是對的。',
      bad: '小易想把專題題目整個換掉，做到半夜才發現新題目更難。今天先別衝動，維持原計畫。',
    },
  },
  present: {
    name: '上台報告', cats: [0, 4], glyph: '講',
    low: '忘詞', monday: '週一沒精神',
    tips: { good: '台風穩健，該上台就上台。', fair: '可以上，先多排練一次。', bad: '容易忘詞，能換順序就換到後面。' },
    stories: {
      good: '小易上台時投影片一張張順順地翻，問答時間還被老師稱讚觀點有趣。',
      fair: '報告到一半投影片當掉，小易先口頭講完重點，重開後補上圖表，有驚無險。',
      bad: '小易一上台腦袋一片空白，看著投影片念了十分鐘。下次記得先對著鏡子練一次。',
    },
  },
  nap: {
    name: '補眠', cats: [5, 2], glyph: '眠',
    tips: { good: '睡個好覺，醒來精神百倍。', fair: '小睡二十分鐘剛剛好。', bad: '容易睡過頭，記得設鬧鐘。' },
    stories: {
      good: '午休小易趴著睡了二十分鐘，醒來神清氣爽，下午的課一點都不想睡。',
      fair: '小易小睡一下，醒來還有點昏，喝了杯水就好多了。',
      bad: '小易說只睡十分鐘，醒來已經是下一堂的下課鐘。今天補眠記得設兩個鬧鐘。',
    },
  },
  dinner: {
    name: '聚餐約會', cats: [0, 5], glyph: '宴',
    tips: { good: '聊得來，適合約人、拉近關係。', fair: '照常赴約，話題輕鬆就好。', bad: '容易話不投機，敏感話題先別碰。' },
    stories: {
      good: '和老朋友約吃飯，從大學聊到現在，小易笑到肚子痛，約好下個月再聚。',
      fair: '聚餐氣氛普普，小易負責點菜和找話題，吃完各自回家，也算愉快。',
      bad: '小易約會遲到二十分鐘，餐廳又剛好客滿，兩人在門口尷尬了很久。今天出門早一點。',
    },
  },
  reading: {
    name: '讀書', cats: [1, 5], glyph: '讀',
    tips: { good: '專注力高，讀什麼都吸收得進去。', fair: '一次讀一章，做點筆記。', bad: '容易分心，先把手機收起來。' },
    stories: {
      good: '小易翻開放了好久的那本書，一口氣讀完三章，還寫了一頁心得。',
      fair: '小易讀了十頁就開始想別的事，做了筆記之後，總算又讀了十頁。',
      bad: '小易打開書，順手滑了一下手機，再抬頭已經是一小時後，書還停在第一頁。',
    },
  },
  finance: {
    name: '理財', cats: [4, 1], glyph: '財',
    low: '住套房', high: '財神到', friday: '週五別梭哈',
    tips: { good: '判斷清楚，適合檢視帳戶、做規劃。', fair: '記帳、看看就好，不急著出手。', bad: '容易衝動，今天不宜大筆買賣。' },
    stories: {
      good: '小易把半年的帳整理成表，發現每月訂閱多花了八百元，一口氣退掉三個，心情超好。',
      fair: '小易打開記帳 App 補登這週的花費，沒什麼特別，維持原本的定期定額。',
      bad: '朋友說某檔股票會漲，小易差點全押，最後忍住只買了一張，隔天就跌停。今天別衝動。',
    },
  },
  tidy: {
    name: '整理房間', cats: [3, 5], glyph: '淨',
    tips: { good: '行動力強，一口氣整理到底。', fair: '一次整理一個角落就好。', bad: '容易越整越亂，先決定要丟什麼。' },
    stories: {
      good: '小易從書桌開始整理，越整越起勁，最後連衣櫃都換季了，房間像新的一樣。',
      fair: '小易整理了書桌，其他地方留給下週。至少現在找得到筆了。',
      bad: '小易把所有東西倒在床上準備分類，整理到一半累了，只好睡在一堆衣服旁邊。',
    },
  },
  trip: {
    name: '出遊', cats: [4, 5], glyph: '遊',
    low: '宅在家', friday: '週五塞車',
    tips: { good: '說走就走，出門一路順。', fair: '可以出門，先查好天氣和交通。', bad: '容易塞車或下雨，能改期就改期。' },
    stories: {
      good: '小易臨時決定去海邊，一路綠燈、天氣晴朗，還看到這季最漂亮的夕陽。',
      fair: '出門前查了天氣，小易帶了傘，下午果然下了陣雨，躲進咖啡廳也挺愉快。',
      bad: '小易興沖沖出門，高速公路塞了兩小時，到了景點剛好下大雨。今天還是待在家吧。',
    },
  },
  workout: {
    name: '運動', cats: [5, 3], glyph: '動',
    tips: { good: '體力充沛，適合動一動、流個汗。', fair: '輕鬆動一下，伸展也算數。', bad: '容易拉傷，今天強度放低。' },
    stories: {
      good: '小易下班去慢跑，跑完五公里還不覺得累，回家洗個澡睡得特別好。',
      fair: '小易在家做了十分鐘伸展，沒有很激烈，但肩頸舒服多了。',
      bad: '小易久久沒運動，一進健身房就挑戰重量，隔天全身痠到下不了床。今天慢慢來。',
    },
  },
}

/** 問事範圍（樣板）：可複選，評分的事項為所選樣板的聯集 */
export const TEMPLATES = [
  { id: 'life', name: '生活', sel: ['dinner', 'reading', 'finance', 'tidy', 'trip', 'workout'] },
  { id: 'eng', name: '工程師', sel: ['meeting', 'report', 'debug', 'develop', 'deploy', 'fish'] },
  { id: 'admin', name: '行政', sel: ['meeting', 'memo', 'reimburse', 'schedule', 'approval', 'teatime'] },
  { id: 'student', name: '學生', sel: ['group', 'homework', 'exam', 'project', 'present', 'nap'] },
]

/** 預設問事：生活 */
export const DEFAULT_TPLS = ['life']

/** 未記錄事項的舊卦例沿用工程師（與核心的 DEFAULT_ITEMS 相同） */
export const LEGACY_SEL = TEMPLATES[1].sel

const TPL_IDS = new Set(TEMPLATES.map(t => t.id))
export const validTpls = tpls => Array.isArray(tpls) && tpls.length > 0 && tpls.every(id => TPL_IDS.has(id))

/** 所選樣板 → 事項代號（依樣板順序合併、去重） */
export const tplsToSel = tpls => [...new Set(TEMPLATES.filter(t => tpls.includes(t.id)).flatMap(t => t.sel))]

/** 事項選擇是否合法：不重複且存在的事項代號 */
export const validSel = sel => Array.isArray(sel) && sel.length > 0 && sel.length <= 30
  && new Set(sel).size === sel.length && sel.every(id => Object.hasOwn(ITEMS, id))

/** 事項選擇 → 評分用的事項 { id, name, cats } */
export const resolveSel = sel => (validSel(sel) ? sel : LEGACY_SEL).map(id => ({ id, name: ITEMS[id].name, cats: ITEMS[id].cats }))

/** 事項選擇剛好是哪幾個樣板的聯集；不是則為 null */
export function tplsOf(sel) {
  const tpls = TEMPLATES.filter(t => t.sel.every(id => sel.includes(id))).map(t => t.id)
  const union = tplsToSel(tpls)
  return union.length === sel.length && union.every((id, i) => id === sel[i]) ? tpls : null
}

/** 選擇 → 分享碼片段：樣板代號以 . 連接；舊卦例的非樣板組合用事項代號 */
export function selToCode(sel) {
  const tpls = tplsOf(sel)
  return tpls ? tpls.join('.') : sel.join('.')
}

/** 分享碼片段 → 選擇；無片段為舊連結（工程師），無法解讀時為 null */
export function codeToSel(code) {
  if (!code) return LEGACY_SEL
  const ids = code.split('.')
  if (validTpls(ids)) return tplsToSel(ids)
  return validSel(ids) ? ids : null
}

/** 評分結果（帶 id）對應的提醒、小故事、印章 */
export const tipFor = (s, level) => ITEMS[s.id]?.tips[level] ?? ''
export const storyFor = (s, level) => ITEMS[s.id]?.stories[level] ?? null
export const stampsOf = s => ITEMS[s.id] || {}

/** 事項的代表字（水墨粒子動畫聚成的字） */
export const glyphFor = s => ITEMS[s.id]?.glyph || s.name.slice(0, 1)

/**
 * 篆字字型（敬峰中山王篆的子集，見 web/fonts/）依簡體字碼收字：代表字為繁體時對應到字型裡的字碼。
 * 新增事項時，若代表字不在字型內，先在這裡補對應，再重跑 scripts/build-seal-font.py
 */
export const SEAL_CODE = {
  會: '会', 蟲: '虫', 發: '发', 魚: '鱼', 帳: '账', 簽: '签', 習: '习',
  題: '题', 講: '讲', 讀: '读', 財: '财', 淨: '净', 遊: '游', 動: '动',
}

/** 事項代表字在篆字字型中的字碼 */
export const sealFor = s => SEAL_CODE[glyphFor(s)] || glyphFor(s)

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
