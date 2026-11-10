# CONTAC — Preguntas abiertas

Decisiones que necesitamos del negocio antes o durante la construcción.

## Reglas contables

1. ✅ **Partidas descuadradas — decidido 2026-11-10** (revisable si surge la necesidad).
   Una partida es `borrador` o `aplicada`. Un borrador puede estar descuadrado y no afecta
   saldos ni reportes; para aplicarla, cargos = abonos. Se elimina `cfg_cuadre`.
   Contexto del negocio: hoy las partidas descuadradas no son una necesidad; se descubren
   después, cuando el balance no cuadra, y entonces se buscan partidas descuadradas o errores
   de catálogo. Consecuencias:
   - El importador trae las partidas descuadradas del legado tal como están, marcadas, y
     genera un reporte por empresa de partidas descuadradas y errores de catálogo.
   - Se mantiene la consulta "Partidas descuadradas" (borradores pendientes e importadas con diferencia).
   - Pendiente de preguntar: ¿por qué quedan grabadas descuadradas (trabajo a medias, o
     vienen así de "Subir Partida Contable" / Bancos)?
2. ✅ **Catálogo por período fiscal — decidido 2026-11-10.** Un solo catálogo por empresa;
   `periodo.cata` no se migra como concepto. Las cuentas se desactivan, nunca se borran, y
   los cambios quedan en bitácora. Los reportes de años anteriores muestran los nombres actuales.
   - Sin verificar en los datos: el importador debe avisar si una empresa tiene catálogo
     alterno en `PERIODO`, o si un mismo código nombra cuentas distintas entre años.
3. **Tipo de cuenta "Contra" (7) y "Orden" (6).** Confirmar cómo deben presentarse en Balance General.
4. ✅ **Cierre anual — decidido 2026-11-10.** Año fiscal configurable (`gl_fiscal_years` con
   mes de inicio y fin), enero–diciembre por defecto. Sin partida de apertura: los saldos se
   calculan desde las líneas y las cuentas de balance se arrastran solas. El cierre anual
   funciona como hoy y la partida queda con `source = cierre`, para que el Estado de
   Resultados del último mes la excluya.
   - Migración: se importa todo el historial; donde no exista, una sola partida de apertura
     (`source = importado`) con el `saldoant` más antiguo de `SALDOS`.
   - Sin verificar en los datos: si algún cliente cierra en un mes distinto a diciembre (`PERIODO`).
5. ✅ **Numeración — decidido 2026-11-10.** Mensual por tipo de partida, igual que hoy
   (único: empresa + período + tipo + número). La migración no renumera. Una partida anulada
   conserva su número; no se reutiliza.
6. **Fecha de cobro** (`fcobro`) en las líneas: ¿para qué se usa?

## Pantallas y reportes

7. ¿Cuáles reportes de la lista ya **no** se usan? (en particular: "B. Comprobación 2",
   "Estado de Cambio", "Numerar Páginas", "Copiar Archivo").
8. Estados de resultados: hoy existen comercial, industrial, mensual, definido y comparativos.
   Propuesta: un solo motor con plantillas (comercial / industrial / personalizadas).
9. ¿Se imprimen libros legales foliados (Diario, Mayor)? ¿Formato exigido por Hacienda?
10. ¿Qué formato tiene el archivo de "Subir Partida Contable" e "Importar Catálogo"?

## Empresas y usuarios

11. ¿Algún cliente consolida empresas hoy ("Generar Partida Consolidada")?
12. ¿Se necesita mantener permiso **por pantalla** además de los 4 niveles, o basta con roles?
13. ✅ **Moneda — decidido 2026-11-10.** Una moneda por empresa (`core_empresas.moneda`,
    desde `EMPRESAS.moneda`), sin multimoneda: no hay tipos de cambio ni moneda por línea.
    Montos con dos decimales. La UI y los reportes toman el símbolo de la empresa.
    - Sin verificar en los datos: qué valores tiene `EMPRESAS.moneda`.

## Integraciones (definir al hacer cada módulo)

14. **Bancos:** genera partidas en CONTAC (`generado = 1`) y comparte correlativos.
    En la plataforma nueva Bancos publicará partidas en el GL vía API interna.
15. **IVA:** "Ingresar al IVA" / "Ingresar Renta" desde una partida con cuenta de IVA crédito fiscal o renta.
16. **Planilla, CxC, Inventario, Activo Fijo:** confirmar cuáles generan partidas en contabilidad.
