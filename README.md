# 💰 ZonaProp Estimador de Créditos Hipotecarios

Extensión de Chrome para calcular estimaciones de créditos hipotecarios en ZonaProp.com.ar.

## 🚀 Características

- Detección automática de precios en ZonaProp
- Cotización en tiempo real del dólar oficial
- Cálculo de cuotas mensuales para 5, 10 y 15 años
- Configuración personalizable de anticipo y TNA

## 📋 Instalación

1. Abrir Chrome y ir a `chrome://extensions/`
2. Activar "Modo de desarrollador"
3. Hacer clic en "Cargar extensión sin empaquetar"
4. Seleccionar la carpeta del proyecto

## 🎯 Uso

1. Configurar anticipo y TNA en el popup de la extensión
2. Visitar una propiedad en ZonaProp
3. Hacer clic en el botón "Estimar Crédito" junto al precio
4. Ver las estimaciones de cuotas mensuales

## 📊 Ejemplo

- Propiedad: USD 195,000
- Anticipo: USD 20,000
- TNA: 4.5%
- Resultado: Cuotas mensuales para 5, 10 y 15 años

## ⚠️ Importante

Las estimaciones son aproximadas. Consulta con tu banco para información precisa.

## 🔧 Archivos

- `manifest.json`: Configuración de la extensión
- `content.js`: Script principal
- `styles.css`: Estilos
- `popup.html/js`: Interfaz de configuración
- `options.html/js`: Página de opciones avanzadas

## 🔄 API utilizada

- DolarAPI: `https://dolarapi.com/v1/dolares/oficial`

La extensión utiliza la API gratuita de DolarAPI para obtener la cotización oficial:
- Endpoint: `https://dolarapi.com/v1/dolares/oficial`
- Actualización: En tiempo real
- Fallback: Valor por defecto si la API no responde

## 🛡️ Privacidad y seguridad

- **Sin recopilación de datos**: La extensión no envía información personal
- **Almacenamiento local**: Las configuraciones se guardan en Chrome
- **Permisos mínimos**: Solo accede a ZonaProp y la API del dólar
- **Sin tracking**: No hay seguimiento de actividad

## 🐛 Solución de problemas

### El botón no aparece
- Verifica que estés en una página de propiedad de ZonaProp
- Recarga la página (F5)
- Revisa que la extensión esté activada

### Los cálculos no son correctos
- Verifica la configuración de anticipo y TNA
- Comprueba que el precio se detecte correctamente
- Intenta recargar la página

### Error de conexión
- Verifica tu conexión a internet
- La API del dólar puede estar temporalmente no disponible
- La extensión usará un valor por defecto

## 📝 Desarrollo

### Estructura del proyecto
```
zonaprop-morgage-estimator/
├── manifest.json          # Configuración de la extensión
├── content.js             # Script principal
├── styles.css             # Estilos
├── popup.html             # Interfaz del popup
├── popup.js               # Lógica del popup
├── options.html           # Página de opciones
├── options.js             # Lógica de opciones
└── README.md              # Este archivo
```

### Tecnologías utilizadas
- **JavaScript ES6+**: Lógica principal
- **CSS3**: Estilos y animaciones
- **HTML5**: Interfaz de usuario
- **Chrome Extensions API**: Integración con Chrome
- **Fetch API**: Comunicación con API externa

### Contribuir
1. Fork del repositorio
2. Crear rama para nueva funcionalidad
3. Realizar cambios
4. Crear Pull Request

## 📞 Soporte

Si encuentras problemas o tienes sugerencias:
- Crear un issue en GitHub
- Contactar al desarrollador
- Revisar la documentación

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles

## 🎉 Agradecimientos

- **ZonaProp** por ser una excelente plataforma inmobiliaria
- **DolarAPI** por proporcionar cotizaciones actualizadas
- **Comunidad de desarrolladores** por el feedback y sugerencias

---

**Versión:** 1.0  
**Última actualización:** 2024  
**Compatibilidad:** Chrome 88+ 