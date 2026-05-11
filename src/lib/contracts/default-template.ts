// ============================================================
// Default residential rental contract template — Costa Rica.
//
// This HTML is the canonical source. It's both:
//   1. Held as a TS constant (this file) for easy diffing in PRs.
//   2. Seeded into `contract_templates` row at migration time so
//      the API can SELECT it by id at runtime.
//
// Placeholder syntax: {{section.field_name}}.
// Every placeholder corresponds to a path inside `ContractData`
// (see `src/types/contracts.ts`).
//
// The HTML uses semantic tags (h1/h2/p/ul/li/strong) so it round-
// trips cleanly through Tiptap, our DOCX generator, and the
// react-pdf renderer.
//
// Legal note: this template was derived from a real CR residential
// lease (Khaya Curridabat). Every concrete value (names, dates,
// amounts, condo names, IBAN, emails) has been replaced with a
// placeholder. NO hardcoded PII.
// ============================================================

export const DEFAULT_RENTAL_TEMPLATE_NAME =
  "Contrato de arrendamiento residencial — Costa Rica"

export const DEFAULT_RENTAL_TEMPLATE_DESCRIPTION =
  "Plantilla base para contratos de alquiler residencial en Costa Rica, conforme a la Ley General de Arrendamientos Urbanos y Suburbanos N° 7527."

/** Placeholder schema persisted alongside the template — used by the
 *  health-check service to know which paths the template references. */
export const DEFAULT_RENTAL_TEMPLATE_PLACEHOLDERS: string[] = [
  // contract meta
  "contract.city",
  "contract.signing_date_words",
  // landlord
  "landlord.identification_block",  // synthetic — adapts to id_type
  "landlord.full_name",
  "landlord.id_number",
  "landlord.civil_status",
  "landlord.profession",
  "landlord.domicile",
  "landlord.email",
  "landlord.bank_name",
  "landlord.iban",
  "landlord.payment_confirmation_email",
  // tenant
  "tenant.identification_block",    // synthetic — adapts to id_type
  "tenant.full_name",
  "tenant.id_number",
  "tenant.passport_country",        // only referenced when id_type === passport
  "tenant.nationality",             // only referenced when id_type === passport
  "tenant.civil_status",
  "tenant.profession",
  "tenant.domicile",
  // property
  "property.condominium_name",
  "property.unit_number",
  "property.unit_number_words",
  "property.folio_real",
  "property.folio_real_words",
  "property.parking_folio_real",
  "property.parking_folio_real_words",
  "property.province",
  "property.canton",
  "property.district",
  "property.floor",
  "property.parking_floor",
  "property.bedrooms",
  "property.bathrooms",
  "property.parking_spaces",
  "property.use",
  "property.description",
  // terms
  "terms.start_date_words",
  "terms.end_date_words",
  "terms.term_months",
  "terms.max_renewal_years",
  "terms.early_termination_notice_months",
  // payments
  "payments.rent_amount",
  "payments.rent_amount_words",
  "payments.rent_currency",
  "payments.deposit_amount",
  "payments.deposit_amount_words",
  "payments.deposit_currency",
  "payments.payment_due_day",
  "payments.last_payment_day_without_default",
  // delivery
  "delivery.keys_count",
  "delivery.access_cards_count",
  "delivery.vehicle_stickers_count",
]

// Helper to keep the template literal readable: allows soft line breaks
// inside paragraphs without producing them in the rendered HTML.
const ws = (s: string): string => s.replace(/\s+/g, " ").trim()

const TITLE = `<h1 style="text-align:center;">CONTRATO PRIVADO DE ARRENDAMIENTO DE APARTAMENTO {{property.unit_number}} EN CONDOMINIO {{property.condominium_name}}</h1>`

// Party clauses use the synthetic `identification_block` placeholder
// instead of inlining each PII field. The block adapts to the id_type
// (cédula vs pasaporte vs DIMEX) — see `withDerivedFields` in
// `contract-generation-service.ts` for how it's built. This avoids
// the template begging for `{{tenant.passport_country}}` when the
// tenant uses a cédula (and vice-versa).
const PARTIES = `
<p>Entre nosotros,</p>

<p><strong>A)</strong> Por una parte, {{landlord.identification_block}}, en mi condición de propietario que en adelante se denominará <strong>"EL ARRENDANTE"</strong>; y</p>

<p><strong>B)</strong> Por la otra parte, {{tenant.identification_block}}, en adelante y para los efectos de este contrato conocido como <strong>"LA PARTE ARRENDATARIA"</strong>, manifestamos:</p>

<p>${ws(`Que hemos acordado celebrar el presente CONTRATO DE ARRENDAMIENTO HABITACIONAL,
el cual se regirá por las disposiciones contenidas en la Ley número siete mil quinientos veintisiete,
denominada Ley General de Arrendamientos Urbanos y Suburbanos, la normativa vigente aplicable a la
materia y las siguientes estipulaciones:`)}</p>
`

const C1_OBJETO = `
<h2>PRIMERA: OBJETO DEL CONTRATO</h2>
<p>${ws(`EL ARRENDANTE es propietario de una UNIDAD HABITACIONAL compuesta por un apartamento y
un estacionamiento, situado en el distrito {{property.district}}, del cantón {{property.canton}},
de la provincia de {{property.province}}, con las siguientes matrículas de folio real:`)}</p>

<p><strong>UNO)</strong> ${ws(`Ubicado en el piso {{property.floor}} de la finca filial número {{property.folio_real}}
({{property.folio_real_words}}), destinada a uso residencial. Se trata de un apartamento de
{{property.bedrooms}} habitaciones y {{property.bathrooms}} baños, situado en el Condominio
{{property.condominium_name}}, en el distrito {{property.district}}, del cantón {{property.canton}},
de la provincia de {{property.province}}.`)}</p>

<p>${ws(`El inmueble objeto del presente contrato se describe de la siguiente forma: {{property.description}}.
Las partes acuerdan que el detalle del mobiliario forma parte integral del inmueble arrendado y
deberá ser conservado en el mismo estado en que fue entregado, salvo el desgaste normal derivado
del uso y del transcurso del tiempo. Estos bienes no podrán ser retirados, sustituidos ni dañados
bajo ninguna circunstancia, salvo autorización previa, expresa y por escrito otorgada por
EL ARRENDANTE.`)}</p>

<p>${ws(`LA PARTE ARRENDATARIA será responsable de cualquier daño, pérdida o deterioro injustificado,
y deberá asumir el costo de reparación o reposición correspondiente.`)}</p>

<p><strong>DOS) ESTACIONAMIENTO:</strong> ${ws(`{{property.parking_spaces}} parqueo(s) en el piso
{{property.parking_floor}} correspondiente(s) a la finca filial número {{property.parking_folio_real}}
({{property.parking_folio_real_words}}), destinada a estacionamiento, situada en el distrito
{{property.district}}, del cantón {{property.canton}}, de la provincia de {{property.province}}.
EL ARRENDANTE otorga en arriendo el inmueble descrito anteriormente a LA PARTE ARRENDATARIA quien
manifiesta su aceptación bajo las condiciones que aquí se estipulan.`)}</p>

<p>${ws(`LA PARTE ARRENDATARIA acepta que el inmueble se encuentra claramente identificado de las
demás áreas construidas y se le entrega en óptimo estado de uso y conservación, limpio y en
condiciones óptimas para la actividad conforme a su naturaleza. Las plazas de aparcamiento
asignadas serán de uso exclusivo de LA PARTE ARRENDATARIA.`)}</p>
`

const C2_PLAZO = `
<h2>SEGUNDA: PLAZO DEL PRESENTE CONTRATO</h2>
<p>${ws(`El presente contrato tendrá un plazo de {{terms.term_months}} meses que empezará a regir a
partir del día {{terms.start_date_words}}. Si dentro de los
{{terms.early_termination_notice_months}} meses anteriores a la expiración del plazo original las
partes no manifestaren por escrito su voluntad de no renovar el presente contrato de
arrendamiento, el mismo se entenderá renovado automáticamente por un período igual al inicialmente
pactado, por un máximo de {{terms.max_renewal_years}} años, finalizando el {{terms.end_date_words}}.`)}</p>

<p>${ws(`Una vez transcurrido el primer año del contrato, LA PARTE ARRENDATARIA podrá dar por
terminado el arrendamiento, siempre y cuando comunique su decisión por escrito con al menos
{{terms.early_termination_notice_months}} meses de antelación al vencimiento del año corriente.
Dicha notificación deberá remitirse a EL ARRENDANTE vía correo electrónico con acuse de recibo.`)}</p>

<p>Asimismo, LA PARTE ARRENDATARIA no tendrá derecho a la devolución del depósito de garantía en caso de que:</p>
<ul>
  <li>${ws(`No se realice el aviso previo de {{terms.early_termination_notice_months}} meses
calendario antes de desocupar el inmueble; o`)}</li>
  <li>Se desocupe el inmueble antes de cumplir el año mínimo pactado de arrendamiento.</li>
</ul>
`

const C3_DESTINO = `
<h2>TERCERA: DESTINO DEL INMUEBLE</h2>
<p>${ws(`El destino autorizado del inmueble será el de <strong>{{property.use}}</strong>, no pudiendo
variar dicho giro, salvo previa autorización por escrito de EL ARRENDANTE solicitada con por lo
menos un mes de antelación. El inmueble no podrá destinarse a fines industriales, comerciales o
lucrativos.`)}</p>

<p>${ws(`EL ARRENDANTE declara que el inmueble cumple con los estándares estructurales requeridos
por Ley y que el Condominio donde se ubica cumple con los requisitos para su operación
habitacional. LA PARTE ARRENDATARIA se compromete a:`)}</p>

<ol>
  <li>No utilizar el inmueble para fines distintos a los aquí estipulados.</li>
  <li>${ws(`No almacenar material o equipo que pueda aumentar el riesgo de fuego, explosión o
contaminación, o que pueda aumentar las tarifas del seguro contra incendios, o que ponga en
riesgo la salud o el orden público.`)}</li>
  <li>${ws(`No colocar rótulos de propaganda ni papeles en la fachada o puerta del inmueble sin
previa autorización por escrito de EL ARRENDANTE.`)}</li>
  <li>No causar ruidos, escándalos, o cualquier acto que pudiera alterar la tranquilidad pública.</li>
  <li>${ws(`Respetar el Reglamento Condominal del Condominio {{property.condominium_name}}, mismo
que EL ARRENDANTE entregará a LA PARTE ARRENDATARIA a la firma del presente contrato, así como
la Ley de Propiedad en Condominio.`)}</li>
  <li>${ws(`Solo se permitirá el ingreso y permanencia de mascotas dentro del apartamento y áreas
comunes si han sido previamente autorizadas por escrito por EL ARRENDANTE. Para introducir una
nueva mascota, deberá notificarlo por escrito y obtener la autorización expresa.`)}</li>
  <li>Queda prohibido el subarriendo o la cesión total o parcial del presente contrato.</li>
  <li>Por ningún concepto podrá ser reconocido el elemento comercial denominado "derecho de llave".</li>
  <li>${ws(`Queda absolutamente prohibido a LA PARTE ARRENDATARIA dar en garantía mobiliaria el
derecho de arrendamiento que por este contrato se constituye en su favor.`)}</li>
</ol>
`

const C4_PRECIO = `
<h2>CUARTA: PRECIO, FORMA DE PAGO E INCREMENTOS</h2>
<p><strong>a. Precio del arriendo:</strong> ${ws(`El precio mensual del arriendo será de
{{payments.rent_amount_words}} ({{payments.rent_currency}} {{payments.rent_amount}}), moneda de
curso legal. {{payments.maintenance_included_clause}}. En caso de incurrir en multas por
incumplimiento de cualquier disposición del reglamento del condominio o de este contrato, las
mismas serán de exclusiva responsabilidad de LA PARTE ARRENDATARIA.`)}</p>

<p>${ws(`El monto del arrendamiento deberá pagarse por adelantado, el día
{{payments.payment_due_day}} de cada mes calendario comprendido dentro del plazo contractual.
El pago no podrá efectuarse después del día {{payments.last_payment_day_without_default}} de cada
mes; cualquier pago posterior se considerará en mora automática, salvo acuerdo previo y por
escrito entre ambas partes.`)}</p>

<p>${ws(`El depósito de garantía deberá realizarse al momento de la firma del presente contrato.
Los pagos mensuales deberán realizarse mediante depósito o transferencia bancaria a la siguiente
cuenta a nombre de {{landlord.full_name}}, cédula {{landlord.id_number}}:`)}</p>

<ul>
  <li><strong>{{landlord.bank_name}}</strong></li>
  <li>Cuenta IBAN: <strong>{{landlord.iban}}</strong></li>
</ul>

<p>${ws(`Todo comprobante de pago deberá ser notificado mediante correo electrónico a la dirección:
<strong>{{landlord.payment_confirmation_email}}</strong>.`)}</p>

<p>${ws(`En la fecha de inicio del arrendamiento EL ARRENDANTE hará entrega de
{{delivery.access_cards_count}} tarjeta(s) de ingreso al condominio,
{{delivery.keys_count}} llave(s) de entrada al apartamento y
{{delivery.vehicle_stickers_count}} adhesivo(s) para vehículo. En caso de deterioro o pérdida,
LA PARTE ARRENDATARIA deberá asumir el costo de reposición.`)}</p>

<p>${ws(`Al final de cada año de contrato se realizarán los ajustes de precio del alquiler conforme
a lo establecido en la Ley N° 7527.`)}</p>

<p><strong>b. Mantenimiento:</strong> {{payments.maintenance_clause}}</p>

<p><strong>c. Incumplimiento en el pago puntual:</strong> ${ws(`El incumplimiento del pago del
arriendo en la fecha pactada no genera ningún beneficio ni constituye aceptación tácita en la
variación de la fecha de pago. EL ARRENDANTE se reserva el derecho de ejercer, sin necesidad de
previo aviso, las acciones legales correspondientes de desahucio o desocupación inmediata del
inmueble en caso de comprobarse el primer incumplimiento en el pago, una vez vencido el plazo
máximo establecido (día {{payments.last_payment_day_without_default}} de cada mes).`)}</p>

<p><strong>d. Tributos:</strong> ${ws(`En caso de que debiera cancelarse algún impuesto, tasa o
tributo derivado únicamente de la firma y formalización del presente contrato de arrendamiento,
dicho monto deberá ser cubierto de forma adicional y por separado por LA PARTE ARRENDATARIA.`)}</p>
`

const C5_SERVICIOS = `
<h2>QUINTA: PAGO DE SERVICIOS Y OTRAS OBLIGACIONES</h2>
<p>${ws(`Todos los servicios públicos de agua, luz, teléfono, internet y otros, serán cancelados
por cuenta exclusiva de LA PARTE ARRENDATARIA conforme a los recibos correspondientes. La falta de
pago oportuno de cualquiera de estos servicios será tratada como mora en el pago del arriendo, y
dará base a la resolución del contrato y al desahucio.`)}</p>

<p>${ws(`LA PARTE ARRENDATARIA exime a EL ARRENDANTE de cualquier multa, penalidad o carga que
pudiese surgir a raíz del incumplimiento de lo aquí estipulado, así como de cualquier hecho
generado por terceras personas ajenas a la presente contratación, incluyendo robo, hurto y
accidentes en el interior del inmueble.`)}</p>
`

const C6_REPARACIONES = `
<h2>SEXTA: REPARACIONES, MEJORAS Y MANTENIMIENTO</h2>
<p>${ws(`LA PARTE ARRENDATARIA se obliga a mantener el inmueble arrendado en buenas condiciones
de conservación, mantenimiento, pintura y limpieza, asumiendo por su cuenta todos los gastos
necesarios y utilizando materiales de buena calidad y mano de obra calificada. El sostenimiento
del inmueble incluye las reparaciones por daños ocurridos en el inmueble, incluyendo vidrios,
cerraduras y cualquier otro accesorio. Los daños generados por sus empleados o visitantes serán
responsabilidad exclusiva de LA PARTE ARRENDATARIA.`)}</p>

<p>${ws(`Será responsabilidad de LA PARTE ARRENDATARIA el mantenimiento preventivo del inmueble
y todas las reparaciones derivadas del uso ordinario, incluyendo electrodomésticos, grifería,
lámparas, cortinas, persianas, cerraduras y limpieza de desagües.`)}</p>

<p>${ws(`No será responsabilidad de LA PARTE ARRENDATARIA cubrir reparaciones por vicios ocultos
en la construcción del inmueble, tales como fugas de tuberías por defectos estructurales, piezas
de enchape quebradas por mala instalación, humedad por ventilación deficiente u otras fallas
constructivas. Estas deberán ser atendidas por EL ARRENDANTE o la administración del condominio.`)}</p>

<p>${ws(`No podrá LA PARTE ARRENDATARIA realizar alteraciones en el condominio ni reformas que
alteren la estructura. Cualquier reforma deberá ser autorizada por EL ARRENDANTE por escrito,
previa supervisión estructural. Cualquier mejora que no pueda ser removida sin causar daño al
inmueble quedará en beneficio del mismo sin que EL ARRENDANTE deba reconocer indemnización.`)}</p>
`

const C7_INVIOLABILIDAD = `
<h2>SÉTIMA: CLÁUSULA DE INVIOLABILIDAD</h2>
<p>LA PARTE ARRENDATARIA se compromete a no violar ninguna de las cláusulas del presente contrato. Serán causales de desocupación inmediata:</p>
<ol>
  <li>La falta de pago en la fecha pactada.</li>
  <li>El subarriendo o la cesión del presente contrato, así como la pignoración del derecho de arriendo.</li>
  <li>El cambio de destino sin la previa autorización de EL ARRENDANTE.</li>
  <li>La violación del Reglamento del Condominio donde se ubica el inmueble.</li>
  <li>El incumplimiento de cualesquiera otras obligaciones asumidas dentro del presente contrato o que señale la ley marco aplicable.</li>
</ol>
`

const C8_GARANTIA = `
<h2>OCTAVA: GARANTÍA DE CUMPLIMIENTO</h2>
<p>${ws(`En garantía de cumplimiento del presente contrato, LA PARTE ARRENDATARIA ha entregado a
EL ARRENDANTE la suma de <strong>{{payments.deposit_amount_words}}</strong>
(<strong>{{payments.deposit_currency}} {{payments.deposit_amount}}</strong>). El monto entregado
le será devuelto a LA PARTE ARRENDATARIA treinta (30) días después de finalizado el presente
contrato, previa inspección del estado del inmueble, siempre y cuando se haya dado fiel
cumplimiento a todas las obligaciones aceptadas.`)}</p>

<p>${ws(`El depósito servirá para responder por cualquier daño causado al inmueble que no fuere
reparado, así como para cubrir recibos pendientes por servicios. Bajo ninguna circunstancia podrá
utilizarse para el pago de mensualidades de arriendo.`)}</p>

<p>${ws(`EL ARRENDANTE se reserva el derecho de recurrir a la vía judicial para exigir
indemnización por daños y perjuicios en caso de que los daños superen la suma de garantía aquí
rendida.`)}</p>
`

const C9_INSPECCION = `
<h2>NOVENA: INSPECCIÓN MENSUAL Y ABANDONO DE INMUEBLE</h2>
<p>${ws(`LA PARTE ARRENDATARIA autoriza expresamente a EL ARRENDANTE, o a quien designe, para que
mensualmente realice una visita al inmueble a efecto de comprobar su estado. La visita se
comunicará por escrito o verbal con al menos cuarenta y ocho (48) horas de antelación, y se
practicará durante días y horas hábiles.`)}</p>

<p>${ws(`En caso de que LA PARTE ARRENDATARIA se encuentre en mora en el pago del arrendamiento y
además deje de ocupar el inmueble, o lo abandone sin aviso previo y por escrito a EL ARRENDANTE,
constituirá este hecho en resolución de pleno derecho del contrato. EL ARRENDANTE queda
expresamente autorizado para abrir la puerta y tomar posesión del inmueble. Los bienes muebles
dejados quedarán en custodia de EL ARRENDANTE hasta que se cancelen las sumas adeudadas.`)}</p>
`

const C10_GASTOS = `
<h2>DÉCIMA: GASTOS</h2>
<p>${ws(`Ambas partes se comprometen a pagar por partes iguales los timbres respectivos y los
honorarios de abogados que resulten de la firma del presente contrato.`)}</p>
`

const C11_DOMICILIO = `
<h2>DÉCIMA PRIMERA: DOMICILIO CONTRACTUAL</h2>
<p>${ws(`Cualquier aviso, comunicación o notificación se hará por escrito. De conformidad con los
artículos veinte y veintidós de la Ley de Notificaciones Judiciales, se fijan las siguientes
direcciones:`)}</p>
<ul>
  <li>A LA PARTE ARRENDATARIA: en el inmueble que por este acto arrienda.</li>
  <li>A EL ARRENDANTE: al correo electrónico <strong>{{landlord.email}}</strong>.</li>
</ul>
`

const C12_TRASPASO = `
<h2>DÉCIMA SEGUNDA: DEL TRASPASO DEL BIEN</h2>
<p>${ws(`LA PARTE ARRENDATARIA expresamente reconoce que los derechos y obligaciones creados
mediante este contrato son personales (relación intuito persona). Por lo tanto, no podrá ceder,
traspasar ni permitir que terceras personas hagan uso del presente contrato y del inmueble sin la
previa autorización escrita de EL ARRENDANTE. El incumplimiento de esta obligación será causa de
terminación anticipada del contrato sin responsabilidad alguna para EL ARRENDANTE.`)}</p>
`

const C13_ILEGALIDAD = `
<h2>DÉCIMA TERCERA: DE LA ILEGALIDAD DE LAS CLÁUSULAS</h2>
<p>${ws(`La ilegalidad, ineficacia, invalidez o nulidad de una o varias estipulaciones del
presente documento, declarada por la autoridad competente, no afectará la validez, legalidad o
eficacia de las estipulaciones restantes.`)}</p>
`

const C14_ACUERDO = `
<h2>DÉCIMA CUARTA: ACUERDO DE PARTES</h2>
<p>${ws(`El presente contrato constituye la totalidad de los acuerdos a los que han llegado las
partes, por lo que las mismas se obligan únicamente a lo aquí dispuesto.`)}</p>
`

const C15_FECHA_CIERTA = `
<h2>DÉCIMA QUINTA: RAZÓN DE FECHA CIERTA</h2>
<p>${ws(`Ambas partes se autorizan recíprocamente para comparecer ante el notario público de su
elección, sin que la otra parte deba comparecer, a solicitar que se le inserte razón de fecha
cierta al presente documento.`)}</p>
`

const SIGNATURE = `
<p>${ws(`Leído el presente contrato por las partes y enteradas de su contenido y efectos legales,
lo firmamos de común acuerdo y en fe de cumplimiento, en dos tantos que se reputan como
originales, uno para cada parte, en la ciudad de {{contract.city}}, este día
{{contract.signing_date_words}}.`)}</p>

<p style="margin-top:3rem;">_______________________________________</p>
<p style="text-align:center;"><strong>{{landlord.full_name}}</strong></p>
<p style="text-align:center;"><strong>EL ARRENDANTE</strong></p>

<p style="margin-top:3rem;">_______________________________________</p>
<p style="text-align:center;"><strong>{{tenant.full_name}}</strong></p>
<p style="text-align:center;"><strong>LA PARTE ARRENDATARIA</strong></p>
`

/** Full template HTML — assembled from named clauses for diff-friendly PRs. */
export const DEFAULT_RENTAL_TEMPLATE_HTML: string = [
  TITLE,
  PARTIES,
  C1_OBJETO,
  C2_PLAZO,
  C3_DESTINO,
  C4_PRECIO,
  C5_SERVICIOS,
  C6_REPARACIONES,
  C7_INVIOLABILIDAD,
  C8_GARANTIA,
  C9_INSPECCION,
  C10_GASTOS,
  C11_DOMICILIO,
  C12_TRASPASO,
  C13_ILEGALIDAD,
  C14_ACUERDO,
  C15_FECHA_CIERTA,
  SIGNATURE,
].join("\n").replace(/\n{2,}/g, "\n").trim()
