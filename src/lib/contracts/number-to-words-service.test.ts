// Tests for number-to-words-service. Run with `pnpm test:contracts` or
// directly: `pnpm vitest run src/lib/contracts/number-to-words-service.test.ts`.

import { describe, it, expect } from "vitest"
import {
  integerToSpanishWords,
  amountToSpanishWords,
  dateToSpanishWords,
} from "./number-to-words-service"

describe("integerToSpanishWords", () => {
  it("handles 0..19 (single token)", () => {
    expect(integerToSpanishWords(0)).toBe("cero")
    expect(integerToSpanishWords(7)).toBe("siete")
    expect(integerToSpanishWords(15)).toBe("quince")
    expect(integerToSpanishWords(16)).toBe("dieciséis")
    expect(integerToSpanishWords(19)).toBe("diecinueve")
  })

  it("handles the veinti…/30+y… split correctly", () => {
    expect(integerToSpanishWords(20)).toBe("veinte")
    expect(integerToSpanishWords(21)).toBe("veintiuno")
    expect(integerToSpanishWords(26)).toBe("veintiséis")
    expect(integerToSpanishWords(30)).toBe("treinta")
    expect(integerToSpanishWords(31)).toBe("treinta y uno")
    expect(integerToSpanishWords(99)).toBe("noventa y nueve")
  })

  it("handles cien vs ciento", () => {
    expect(integerToSpanishWords(100)).toBe("cien")
    expect(integerToSpanishWords(101)).toBe("ciento uno")
    expect(integerToSpanishWords(150)).toBe("ciento cincuenta")
    expect(integerToSpanishWords(200)).toBe("doscientos")
    expect(integerToSpanishWords(500)).toBe("quinientos")
    expect(integerToSpanishWords(999)).toBe("novecientos noventa y nueve")
  })

  it("handles the thousands group (1k..999k)", () => {
    expect(integerToSpanishWords(1_000)).toBe("mil")
    expect(integerToSpanishWords(1_001)).toBe("mil uno")
    expect(integerToSpanishWords(1_200)).toBe("mil doscientos")
    expect(integerToSpanishWords(2_000)).toBe("dos mil")
    expect(integerToSpanishWords(2_026)).toBe("dos mil veintiséis")
    expect(integerToSpanishWords(21_000)).toBe("veintiún mil")
    expect(integerToSpanishWords(650_000)).toBe("seiscientos cincuenta mil")
  })

  it("handles the millions group", () => {
    expect(integerToSpanishWords(1_000_000)).toBe("un millón")
    expect(integerToSpanishWords(2_000_000)).toBe("dos millones")
    expect(integerToSpanishWords(21_000_000)).toBe("veintiún millones")
    expect(integerToSpanishWords(1_000_001)).toBe("un millón uno")
    expect(integerToSpanishWords(1_500_000)).toBe(
      "un millón quinientos mil",
    )
  })

  it("rejects bad inputs", () => {
    expect(() => integerToSpanishWords(-1)).toThrow()
    expect(() => integerToSpanishWords(1.5)).toThrow()
    expect(() => integerToSpanishWords(NaN)).toThrow()
    expect(() => integerToSpanishWords(1e15)).toThrow()
  })
})

describe("amountToSpanishWords", () => {
  it("formats USD with EXACTOS for whole amounts (spec example)", () => {
    expect(amountToSpanishWords(1200, "USD"))
      .toBe("MIL DOSCIENTOS DÓLARES EXACTOS")
  })

  it("formats CRC with EXACTOS for whole amounts (spec example)", () => {
    expect(amountToSpanishWords(650_000, "CRC"))
      .toBe("SEISCIENTOS CINCUENTA MIL COLONES EXACTOS")
  })

  it("uses singular noun for amount === 1", () => {
    expect(amountToSpanishWords(1, "USD")).toBe("UN DÓLAR EXACTOS")
    expect(amountToSpanishWords(1, "CRC")).toBe("UN COLÓN EXACTOS")
    // (Strictly, "EXACTO" would be more correct in singular but the
    // template form keeps "EXACTOS" — conventional.)
  })

  it("renders cents as CON XX/100", () => {
    expect(amountToSpanishWords(1500.75, "USD"))
      .toBe("MIL QUINIENTOS DÓLARES CON 75/100")
    expect(amountToSpanishWords(1500.05, "USD"))
      .toBe("MIL QUINIENTOS DÓLARES CON 05/100")
  })

  it("rejects negatives", () => {
    expect(() => amountToSpanishWords(-1, "USD")).toThrow()
  })
})

describe("dateToSpanishWords", () => {
  it("matches the spec example (May 7, 2026)", () => {
    expect(dateToSpanishWords("2026-05-07"))
      .toBe("SIETE DE MAYO DEL AÑO DOS MIL VEINTISÉIS")
  })

  it("renders day=1 as PRIMERO (CR convention)", () => {
    expect(dateToSpanishWords("2026-08-01"))
      .toBe("PRIMERO DE AGOSTO DEL AÑO DOS MIL VEINTISÉIS")
  })

  it("uses SETIEMBRE (CR Spanish) not SEPTIEMBRE", () => {
    expect(dateToSpanishWords("2026-09-15"))
      .toBe("QUINCE DE SETIEMBRE DEL AÑO DOS MIL VEINTISÉIS")
  })

  it("handles end-of-month and end-of-year", () => {
    expect(dateToSpanishWords("2025-12-31"))
      .toBe("TREINTA Y UNO DE DICIEMBRE DEL AÑO DOS MIL VEINTICINCO")
  })

  it("is timezone-stable for ISO yyyy-mm-dd strings", () => {
    // Even if the local TZ is far west of UTC, parsing as UTC
    // midnight gives the calendar date the user typed.
    expect(dateToSpanishWords("2026-05-07"))
      .toBe(dateToSpanishWords(new Date("2026-05-07T00:00:00Z")))
  })

  it("rejects invalid input", () => {
    expect(() => dateToSpanishWords("not-a-date")).toThrow()
  })
})
