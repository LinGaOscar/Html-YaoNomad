/**
 * @typedef {Object} Line
 * @property {number} value - 爻值，固定為 6、7、8 或 9
 * @property {boolean} yin - true = 陰爻（value 為偶數）
 * @property {boolean} changing - true = 老陰(6) 或 老陽(9)
 */

/**
 * @typedef {Object} Hexagram
 * @property {number} number - 文王序列 1–64
 * @property {string} name - 卦名
 * @property {number} upper - 上卦三位碼（0–7）
 * @property {number} lower - 下卦三位碼（0–7）
 * @property {string} judgment - 卦辭
 * @property {string[]} lines - 爻辭，index 0 = 初爻，共 6 條
 * @property {string} image - 大象傳（象曰）
 * @property {string} motto - 一句話提醒
 * @property {string} plain - 白話解釋
 * @property {string} advice - 職場解讀
 */

/**
 * @typedef {Object} CastResult
 * @property {string} question - 問題
 * @property {Line[]} lines - 六爻（index 0 = 初爻）
 * @property {Hexagram} present - 本卦
 * @property {Hexagram|null} future - 變卦；無變爻時為 null
 */

// 此檔案僅提供 JSDoc 型別定義，無執行時期程式碼
