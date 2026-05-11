import { describe, it, expect } from "vitest"
import { findMissingFields, canFinalize } from "./validation"
import { emptyContractData } from "@/types/contracts"

describe("findMissingFields", () => {
  it("flags every required field on a fresh empty draft", () => {
    const fields = findMissingFields(emptyContractData())
    const paths  = fields.map((f) => f.path)
    expect(paths).toContain("landlord.full_name")
    expect(paths).toContain("landlord.id_number")
    expect(paths).toContain("tenant.full_name")
    expect(paths).toContain("property.folio_real")
    expect(paths).toContain("payments.rent_amount")
    expect(paths).toContain("payments.deposit_amount")
    expect(paths).toContain("terms.start_date")
    expect(paths).toContain("terms.end_date")
  })

  it("respects the conditional passport_country rule", () => {
    const data = emptyContractData()
    data.tenant.id_type = "cedula"
    const cedulaFlow = findMissingFields(data).map((f) => f.path)
    expect(cedulaFlow).not.toContain("tenant.passport_country")

    data.tenant.id_type = "passport"
    const passportFlow = findMissingFields(data).map((f) => f.path)
    expect(passportFlow).toContain("tenant.passport_country")
    expect(passportFlow).toContain("tenant.nationality")
  })

  it("only requires bank fields when payment_method is bank_transfer", () => {
    const data = emptyContractData()
    data.payments.payment_method = "cash"
    const cashFlow = findMissingFields(data).map((f) => f.path)
    expect(cashFlow).not.toContain("landlord.iban")
    expect(cashFlow).not.toContain("landlord.bank_name")

    data.payments.payment_method = "bank_transfer"
    const transferFlow = findMissingFields(data).map((f) => f.path)
    expect(transferFlow).toContain("landlord.iban")
    expect(transferFlow).toContain("landlord.bank_name")
    expect(transferFlow).toContain("landlord.payment_confirmation_email")
  })

  it("returns no missing fields when every required field is filled", () => {
    const data = emptyContractData()
    data.landlord.full_name = "María Rojas"
    data.landlord.id_number = "1-1234-5678"
    data.landlord.email     = "maria@example.com"
    data.landlord.bank_name = "BAC"
    data.landlord.iban      = "CR00000000000000000000"
    data.landlord.payment_confirmation_email = "pagos@example.com"
    data.tenant.full_name   = "John Smith"
    data.tenant.id_number   = "PA1234567"
    data.tenant.id_type     = "cedula"
    data.property.condominium_name = "Condo X"
    data.property.unit_number = "3-07"
    data.property.folio_real  = "12345"
    data.terms.start_date     = "2026-05-07"
    data.terms.end_date       = "2027-05-07"
    data.payments.rent_amount    = 1200
    data.payments.deposit_amount = 1200
    expect(findMissingFields(data)).toEqual([])
  })
})

describe("canFinalize", () => {
  it("blocks when fields are missing", () => {
    const r = canFinalize({ data: emptyContractData() })
    expect(r.ok).toBe(false)
    expect(r.missing_fields.length).toBeGreaterThan(0)
    expect(r.blockers[0]).toMatch(/campos requeridos/)
  })

  it("blocks when unresolved placeholders are reported", () => {
    const data = emptyContractData()
    // Make all fields valid
    Object.assign(data.landlord, {
      full_name: "x", id_number: "x", email: "x@x", bank_name: "x",
      iban: "x", payment_confirmation_email: "x@x",
    })
    Object.assign(data.tenant,   { full_name: "x", id_number: "x", id_type: "cedula" })
    Object.assign(data.property, {
      condominium_name: "x", unit_number: "x", folio_real: "x",
    })
    Object.assign(data.terms,    { start_date: "2026-01-01", end_date: "2027-01-01" })
    Object.assign(data.payments, { rent_amount: 1, deposit_amount: 1 })

    const r = canFinalize({ data, unresolved_count: 3 })
    expect(r.ok).toBe(false)
    expect(r.blockers.some((b) => /placeholders/.test(b))).toBe(true)
  })
})
