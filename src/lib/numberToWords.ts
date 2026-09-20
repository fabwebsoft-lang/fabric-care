/**
 * Number to Indian Currency Words utility.
 * Converts numeric amounts (e.g. 1250) into standard Indian English words:
 * e.g. 1250 -> "Rupees One Thousand Two Hundred Fifty Only"
 * e.g. 400 -> "Rupees Four Hundred Only"
 * e.g. 15000.50 -> "Rupees Fifteen Thousand and Fifty Paise Only"
 */

const units = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertBelowThousand(n: number): string {
  let str = "";
  if (n >= 100) {
    str += units[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + units[n % 10] : "") + " ";
  } else if (n > 0) {
    str += units[n] + " ";
  }
  return str.trim();
}

/**
 * Converts a positive number to Indian words representation.
 */
export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "Zero Rupees Only";
  }

  const rounded = Math.round(amount * 100) / 100;
  const wholePart = Math.floor(Math.abs(rounded));
  const paisePart = Math.round((Math.abs(rounded) - wholePart) * 100);

  if (wholePart === 0 && paisePart === 0) {
    return "Zero Rupees Only";
  }

  let result = "";

  if (wholePart > 0) {
    let n = wholePart;

    // Crores (1,00,00,000)
    const crores = Math.floor(n / 10000000);
    n %= 10000000;
    if (crores > 0) {
      result += convertBelowThousand(crores) + " Crore ";
    }

    // Lakhs (1,00,000)
    const lakhs = Math.floor(n / 100000);
    n %= 100000;
    if (lakhs > 0) {
      result += convertBelowThousand(lakhs) + " Lakh ";
    }

    // Thousands (1,000)
    const thousands = Math.floor(n / 1000);
    n %= 1000;
    if (thousands > 0) {
      result += convertBelowThousand(thousands) + " Thousand ";
    }

    // Remaining 1-999
    if (n > 0) {
      result += convertBelowThousand(n) + " ";
    }

    result = "Rupees " + result.trim();
  } else {
    result = "Rupees Zero";
  }

  if (paisePart > 0) {
    const paiseStr = convertBelowThousand(paisePart);
    result += (wholePart > 0 ? " and " : " ") + paiseStr + " Paise";
  }

  return result.trim() + " Only";
}
