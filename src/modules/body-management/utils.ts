/**
 * 计算 BMI，返回保留一位小数的数值。
 * 身高单位 cm，体重单位 kg。
 */
export function calculateBMI(weight: number, heightCm: number): number {
  return +(weight / (heightCm / 100) ** 2).toFixed(1)
}
