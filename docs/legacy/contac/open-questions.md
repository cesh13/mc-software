# CONTAC — Preguntas abiertas

Decisiones que necesitamos del negocio antes o durante la construcción.

## Reglas contables

1. **Partidas descuadradas.** El legado permite grabar partidas descuadradas si `cfg_cuadre`
   está apagado. ¿Algún cliente lo usa así? Propuesta: exigir siempre partidas cuadradas.
2. **Catálogo por período fiscal** (`periodo.cata`). ¿Algún cliente tiene un catálogo distinto
   por año? Propuesta: un solo catálogo por empresa; los cambios entre años son ediciones con bitácora.
3. **Tipo de cuenta "Contra" (7) y "Orden" (6).** Confirmar cómo deben presentarse en Balance General.
4. **Cierre anual.** ¿Se cierra siempre en diciembre o hay años fiscales distintos? ¿La apertura
   del año siguiente es automática (saldos de balance se arrastran)?
5. **Numeración.** ¿Se reinicia el correlativo cada mes para cada tipo (como hoy) o preferirían anual?
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
13. Moneda: ¿solo USD o hay empresas en otra moneda?

## Integraciones (definir al hacer cada módulo)

14. **Bancos:** genera partidas en CONTAC (`generado = 1`) y comparte correlativos.
    En la plataforma nueva Bancos publicará partidas en el GL vía API interna.
15. **IVA:** "Ingresar al IVA" / "Ingresar Renta" desde una partida con cuenta de IVA crédito fiscal o renta.
16. **Planilla, CxC, Inventario, Activo Fijo:** confirmar cuáles generan partidas en contabilidad.
