# 📋 Instrucciones de Instalación - ZonaProp Estimador de Créditos

## 🎯 Antes de comenzar

Esta extensión te permitirá calcular estimaciones de créditos hipotecarios directamente en las páginas de ZonaProp.com.ar.

## 📁 Paso 1: Obtener los archivos

Asegúrate de tener todos estos archivos en una carpeta:

```
zonaprop-loan-estimation/
├── manifest.json
├── content.js
├── styles.css
├── popup.html
├── popup.js
├── options.html
├── options.js
├── icon16.png
├── icon48.png
├── icon128.png
└── README.md
```

## 🎨 Paso 2: Crear los iconos (opcional)

Si no tienes los iconos, puedes crearlos:

1. Abre `create-icons.html` en tu navegador
2. Haz clic en "Generar Iconos"
3. Clic derecho en cada icono → "Guardar imagen como..."
4. Guárdalos como `icon16.png`, `icon48.png`, `icon128.png`

## 🚀 Paso 3: Instalar en Chrome

### 3.1 Abrir página de extensiones
1. Abre Google Chrome
2. Ve a `chrome://extensions/` (copia y pega en la barra de direcciones)
3. O usa el menú: ⋮ → Más herramientas → Extensiones

### 3.2 Activar modo desarrollador
1. En la esquina superior derecha, activa el interruptor "Modo de desarrollador"

### 3.3 Cargar la extensión
1. Haz clic en "Cargar extensión sin empaquetar"
2. Selecciona la carpeta `zonaprop-loan-estimation`
3. Haz clic en "Seleccionar carpeta"

## ✅ Paso 4: Verificar instalación

1. Deberías ver la extensión en la lista con el ícono 💰
2. La extensión aparecerá en la barra de herramientas de Chrome
3. Si no la ves, haz clic en el ícono de puzzle 🧩 y fíjala

## ⚙️ Paso 5: Configuración inicial

1. Haz clic en el ícono de la extensión en la barra de herramientas
2. Configura:
   - **Anticipo**: Monto que tienes disponible en USD (ej: 20000)
   - **TNA**: Tasa Nominal Anual esperada (ej: 4.5)
3. Haz clic en "Guardar Configuración"

## 🏠 Paso 6: Probar la extensión

1. Ve a [ZonaProp](https://www.zonaprop.com.ar)
2. Busca y entra a cualquier propiedad
3. Busca el botón "💰 Estimar Crédito" junto al precio
4. ¡Haz clic y ve las estimaciones!

## 🔧 Paso 7: Configuración avanzada (opcional)

Para más opciones:
1. Clic derecho en el ícono de la extensión
2. Selecciona "Opciones"
3. Configura parámetros adicionales

## ❓ Solución de problemas

### El botón no aparece
- ✅ Verifica que estés en una página de propiedad específica
- ✅ Recarga la página (F5)
- ✅ Verifica que la extensión esté habilitada

### Error "No se detectó precio"
- ✅ Asegúrate de estar en una página que muestre el precio en USD
- ✅ Intenta con otra propiedad
- ✅ Recarga la página

### No se pueden obtener cotizaciones
- ✅ Verifica tu conexión a internet
- ✅ La extensión usará un valor por defecto si falla la API

### Errores de permisos
- ✅ Verifica que el modo desarrollador esté activado
- ✅ Intenta recargar la extensión en chrome://extensions/

## 📱 Uso en móviles

La extensión solo funciona en Chrome para escritorio. No está disponible para móviles.

## 🔄 Actualizar la extensión

Si realizas cambios en el código:
1. Ve a `chrome://extensions/`
2. Busca la extensión
3. Haz clic en el ícono de recarga 🔄

## 🗑️ Desinstalar

Para remover la extensión:
1. Ve a `chrome://extensions/`
2. Busca "ZonaProp Estimador de Créditos"
3. Haz clic en "Quitar"

## 📞 ¿Necesitas ayuda?

Si tienes problemas:
1. Revisa este documento paso a paso
2. Verifica que todos los archivos estén presentes
3. Asegúrate de que Chrome esté actualizado
4. Intenta desinstalar y reinstalar la extensión

## ⚠️ Importante

- Las estimaciones son aproximadas y solo informativas
- Siempre consulta con tu banco para condiciones reales
- La extensión no recopila datos personales
- Solo funciona en páginas de ZonaProp.com.ar

---

¡Listo! Ya puedes usar tu estimador de créditos hipotecarios. 🎉 