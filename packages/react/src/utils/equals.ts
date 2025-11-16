/**
 * 두 값의 얕은 동등성을 비교합니다.
 * 객체와 배열은 1단계 깊이까지만 비교합니다.
 */
export const shallowEquals = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true; // typeof null 이 object이기 때문에.
  if (typeof a === "object" && typeof b === "object") {
    const targetA = Object.entries(a);
    const targetB = Object.entries(b);
    return targetA.length === targetB.length && targetA.every(([key, value]) => Object.is(value, b[key]));
  }
  return false;
};

/**
 * 두 값의 깊은 동등성을 비교합니다.
 * 객체와 배열의 모든 중첩된 속성을 재귀적으로 비교합니다.
 */
export const deepEquals = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true; // typeof null 이 object이기 때문에.
  if (typeof a === "object" && typeof b === "object") {
    const targetA = Object.entries(a);
    const targetB = Object.entries(b);
    return targetA.length === targetB.length && targetA.every(([key, value]) => deepEquals(value, b[key]));
  }
  return false;
};
