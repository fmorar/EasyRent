import { describe, it, expect } from "vitest"
import {
  extractPlaceholders,
  resolvePlaceholders,
  highlightUnresolved,
  htmlToPlainText,
} from "./contract-placeholder-service"
import { emptyContractData } from "@/types/contracts"

describe("extractPlaceholders", () => {
  it("returns unique paths in order of first occurrence", () => {
    const html = `
      <p>{{landlord.full_name}}, {{tenant.full_name}}, {{landlord.full_name}}</p>
      <p>{{property.unit_number}}</p>
    `
    expect(extractPlaceholders(html)).toEqual([
      "landlord.full_name",
      "tenant.full_name",
      "property.unit_number",
    ])
  })

  it("tolerates whitespace inside the braces", () => {
    expect(extractPlaceholders("{{ a.b }}")).toEqual(["a.b"])
  })

  it("returns [] when the html has no placeholders", () => {
    expect(extractPlaceholders("<p>hola</p>")).toEqual([])
  })
})

describe("resolvePlaceholders", () => {
  it("replaces resolvable paths and reports unresolved ones", () => {
    const data = emptyContractData()
    data.landlord.full_name = "María Rojas"
    data.tenant.full_name   = "John Smith"

    const html = `
      <p>{{landlord.full_name}} arrenda a {{tenant.full_name}}.</p>
      <p>Cédula: {{landlord.id_number}}</p>
    `
    const r = resolvePlaceholders(html, data)
    expect(r.html).toContain("María Rojas arrenda a John Smith.")
    expect(r.html).toContain("Cédula: {{landlord.id_number}}")
    expect(r.unresolved).toEqual(["landlord.id_number"])
  })

  it("treats empty strings as unresolved (so the user sees the placeholder)", () => {
    const data = emptyContractData()
    data.landlord.full_name = ""  // explicitly empty
    const r = resolvePlaceholders("<p>{{landlord.full_name}}</p>", data)
    expect(r.unresolved).toEqual(["landlord.full_name"])
    expect(r.html).toContain("{{landlord.full_name}}")
  })

  it("formats numbers with thousands separators", () => {
    const data = emptyContractData()
    data.payments.rent_amount = 1200
    const r = resolvePlaceholders("<p>USD {{payments.rent_amount}}</p>", data)
    expect(r.html).toBe("<p>USD 1,200</p>")
  })

  it("treats 0 as a real value (not unresolved)", () => {
    const data = emptyContractData()
    // bedrooms defaults to 0 — must render as "0", not as missing.
    const r = resolvePlaceholders("<p>{{property.bedrooms}}</p>", data)
    expect(r.unresolved).toEqual([])
    expect(r.html).toBe("<p>0</p>")
  })
})

describe("highlightUnresolved", () => {
  it("wraps remaining placeholders in <mark>", () => {
    const out = highlightUnresolved("hola {{landlord.full_name}}!")
    expect(out).toContain('<mark class="contract-unresolved" data-placeholder>{{landlord.full_name}}</mark>')
  })

  it("leaves text without placeholders untouched", () => {
    expect(highlightUnresolved("<p>hola</p>")).toBe("<p>hola</p>")
  })
})

describe("htmlToPlainText", () => {
  it("strips tags and collapses whitespace", () => {
    const out = htmlToPlainText("<h1>Hola</h1><p>Mundo &amp; gente</p>")
    expect(out).toBe("Hola\nMundo & gente")
  })
})
