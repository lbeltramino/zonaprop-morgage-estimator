// ZonaProp Estimador de Créditos Hipotecarios - Content Script
(function() {
    'use strict';

    // Configuración por defecto
    const DEFAULT_CONFIG = {
        anticipo: 20000, // USD
        tna: 4.5 // %
    };

    // Variables globales
    let currentConfig = DEFAULT_CONFIG;
    let dollarRate = null;
    let currentPropertyPrice = null;
    let propertyData = null;

    // Función para obtener la cotización del dólar
    async function getDollarRate() {
        try {
            const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
            const data = await response.json();
            dollarRate = data.venta;
            return dollarRate;
        } catch (error) {
            console.error('Error obteniendo cotización del dólar:', error);
            return 1260; // Valor por defecto basado en el ejemplo
        }
    }

    // Función para extraer todos los datos de la propiedad
    function extractPropertyData() {
        const data = {
            precio: null,
            titulo: null,
            ubicacion: null,
            descripcion: null,
            caracteristicas: {},
            fotos: [],
            mapa: null,
            inmobiliaria: null,
            fechaPublicacion: null,
            codigo: null,
            url: window.location.href
        };

        // Extraer precio
        data.precio = extractPropertyPrice();

        // Extraer título
        const titleElement = document.querySelector('h1, .section-title h1, .title-type-sup');
        if (titleElement) {
            data.titulo = titleElement.textContent.trim();
        }

        // Extraer ubicación
        const locationElement = document.querySelector('.title-location, .section-location, .info-location');
        if (locationElement) {
            data.ubicacion = locationElement.textContent.trim();
        }

        // Extraer descripción
        const descriptionElement = document.querySelector('#verDatosDescripcion, .section-description, .descriptionContent');
        if (descriptionElement) {
            data.descripcion = descriptionElement.textContent.trim();
        }

        // Extraer características (metros cuadrados, ambientes, etc.)
        const features = document.querySelectorAll('.section-icon-features li, .icon-feature, .block-feature-container');
        features.forEach(feature => {
            const text = feature.textContent.trim();
            
            // Superficie total
            if (text.includes('m²') && text.includes('total')) {
                data.caracteristicas.superficieTotal = text;
            }
            // Superficie cubierta
            else if (text.includes('m²') && text.includes('cubierta')) {
                data.caracteristicas.superficieCubierta = text;
            }
            // Ambientes
            else if (text.includes('ambiente')) {
                data.caracteristicas.ambientes = text;
            }
            // Dormitorios
            else if (text.includes('dormitorio') || text.includes('dorm')) {
                data.caracteristicas.dormitorios = text;
            }
            // Baños
            else if (text.includes('baño')) {
                data.caracteristicas.banos = text;
            }
            // Cochera
            else if (text.includes('cochera')) {
                data.caracteristicas.cochera = text;
            }
            // Antigüedad
            else if (text.includes('año') && (text.includes('antigüedad') || /\d+\s*año/.test(text))) {
                data.caracteristicas.antiguedad = text;
            }
        });

        // Extraer fotos
        const images = document.querySelectorAll('img[src*="zonapropcdn"], .slide-content img, .gallery img');
        images.forEach(img => {
            if (img.src && img.src.includes('zonapropcdn')) {
                // Obtener URL de alta calidad
                let photoUrl = img.src;
                if (photoUrl.includes('280x210')) {
                    photoUrl = photoUrl.replace('280x210', '720x532');
                }
                if (photoUrl.includes('360x266')) {
                    photoUrl = photoUrl.replace('360x266', '720x532');
                }
                data.fotos.push({
                    url: photoUrl,
                    alt: img.alt || 'Foto de la propiedad'
                });
            }
        });

        // Remover duplicados de fotos
        data.fotos = data.fotos.filter((foto, index, self) => 
            index === self.findIndex(f => f.url === foto.url)
        );

        // Extraer información de mapa
        const mapElement = document.querySelector('.static-map, .article-map img');
        if (mapElement && mapElement.src) {
            data.mapa = mapElement.src;
        }

        // Extraer información de inmobiliaria
        const publisherElement = document.querySelector('.publisher-info, .info-data, .publisher-section');
        if (publisherElement) {
            data.inmobiliaria = publisherElement.textContent.trim();
        }

        // Extraer fecha de publicación
        const dateElement = document.querySelector('.section-date, .fecha-publicado');
        if (dateElement) {
            data.fechaPublicacion = dateElement.textContent.trim();
        }

        // Extraer código de propiedad
        const codeElement = document.querySelector('.publisher-code, .codigo-propiedad');
        if (codeElement) {
            data.codigo = codeElement.textContent.trim();
        }

        // Buscar datos adicionales en scripts de la página
        const scriptTags = document.querySelectorAll('script');
        for (let script of scriptTags) {
            if (script.textContent.includes('precioVenta') || script.textContent.includes('propertyData')) {
                try {
                    // Intentar extraer datos estructurados
                    const scriptContent = script.textContent;
                    
                    // Buscar superficie total
                    const superficieTotalMatch = scriptContent.match(/"superficieTotal":\s*"?(\d+)"?/);
                    if (superficieTotalMatch && !data.caracteristicas.superficieTotal) {
                        data.caracteristicas.superficieTotal = superficieTotalMatch[1] + ' m²';
                    }

                    // Buscar superficie cubierta
                    const superficieCubiertaMatch = scriptContent.match(/"superficieCubierta":\s*"?(\d+)"?/);
                    if (superficieCubiertaMatch && !data.caracteristicas.superficieCubierta) {
                        data.caracteristicas.superficieCubierta = superficieCubiertaMatch[1] + ' m²';
                    }

                    // Buscar ambientes
                    const ambientesMatch = scriptContent.match(/"ambientes":\s*"?(\d+)"?/);
                    if (ambientesMatch && !data.caracteristicas.ambientes) {
                        data.caracteristicas.ambientes = ambientesMatch[1] + ' ambientes';
                    }

                    // Buscar dormitorios
                    const dormitoriosMatch = scriptContent.match(/"dormitorios":\s*"?(\d+)"?/);
                    if (dormitoriosMatch && !data.caracteristicas.dormitorios) {
                        data.caracteristicas.dormitorios = dormitoriosMatch[1] + ' dormitorios';
                    }

                    // Buscar baños
                    const banosMatch = scriptContent.match(/"banos":\s*"?(\d+)"?/);
                    if (banosMatch && !data.caracteristicas.banos) {
                        data.caracteristicas.banos = banosMatch[1] + ' baños';
                    }

                } catch (error) {
                    console.log('Error extrayendo datos del script:', error);
                }
            }
        }

        return data;
    }

    // Función para extraer el precio de la propiedad
    function extractPropertyPrice() {
        // Usando el xpath proporcionado
        const xpath = '//*[@id="article-container"]/div[1]/div/div[1]/span[1]/span/text()';
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        
        if (result.singleNodeValue) {
            const priceText = result.singleNodeValue.textContent;
            const priceMatch = priceText.match(/USD\s*(\d+(?:\.\d+)?)/);
            if (priceMatch) {
                return parseFloat(priceMatch[1].replace(/\./g, ''));
            }
        }

        // Fallback: buscar en datos JavaScript de la página
        const scriptTags = document.querySelectorAll('script');
        for (let script of scriptTags) {
            if (script.textContent.includes('precioVenta')) {
                const match = script.textContent.match(/"precioVenta":\s*"USD\s*(\d+)"/);
                if (match) {
                    return parseFloat(match[1]);
                }
            }
        }

        return null;
    }

    // Función para calcular la cuota mensual
    function calculateMonthlyPayment(principal, annualRate, years) {
        const monthlyRate = annualRate / 100 / 12;
        const numberOfPayments = years * 12;
        
        if (monthlyRate === 0) {
            return principal / numberOfPayments;
        }
        
        const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                              (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
        
        return monthlyPayment;
    }

    // Función para crear el botón de estimación
    function createEstimationButton() {
        const button = document.createElement('button');
        button.id = 'zonaprop-credit-estimator';
        button.innerHTML = `
            <span>💰</span>
            <span>Estimar Crédito</span>
        `;
        button.className = 'zp-estimator-btn';
        button.onclick = showEstimationModal;
        return button;
    }

    // Función para crear el botón de reporte
    function createReportButton() {
        const button = document.createElement('button');
        button.id = 'zonaprop-report-generator';
        button.innerHTML = `
            <span>📄</span>
            <span>Generar Reporte</span>
        `;
        button.className = 'zp-report-btn';
        button.onclick = generatePropertyReport;
        return button;
    }

    // Función para generar reporte completo
    async function generatePropertyReport() {
        // Obtener configuración
        const config = await chrome.storage.sync.get(['anticipo', 'tna']);
        currentConfig.anticipo = config.anticipo || DEFAULT_CONFIG.anticipo;
        currentConfig.tna = config.tna || DEFAULT_CONFIG.tna;

        // Obtener cotización del dólar
        if (!dollarRate) {
            await getDollarRate();
        }

        // Extraer todos los datos de la propiedad
        propertyData = extractPropertyData();

        // Calcular estimaciones de crédito
        const montoCredito = propertyData.precio - currentConfig.anticipo;
        const montoCreditoPesos = montoCredito * dollarRate;
        
        const estimaciones = [];
        if (montoCredito > 0) {
            [5, 10, 15].forEach(plazo => {
                const cuotaMensual = calculateMonthlyPayment(montoCreditoPesos, currentConfig.tna, plazo);
                estimaciones.push({
                    plazo: plazo,
                    cuotaMensual: cuotaMensual
                });
            });
        }

        // Crear página de reporte
        const reportWindow = window.open('', '_blank', 'width=1200,height=800');
        reportWindow.document.write(generateReportHTML(propertyData, {
            anticipo: currentConfig.anticipo,
            tna: currentConfig.tna,
            dollarRate: dollarRate,
            montoCredito: montoCredito,
            montoCreditoPesos: montoCreditoPesos,
            estimaciones: estimaciones
        }));
        reportWindow.document.close();
    }

    // Función para generar el HTML del reporte
    function generateReportHTML(property, creditData) {
        const currentDate = new Date().toLocaleDateString('es-AR');
        
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Propiedad - ${property.titulo || 'Sin título'}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        
        .header {
            text-align: center;
            padding: 30px 0;
            border-bottom: 3px solid #ff5722;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #ff5722;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .header .subtitle {
            color: #666;
            font-size: 16px;
        }
        
        .property-info {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }
        
        .main-info {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #e9ecef;
        }
        
        .price-box {
            background: linear-gradient(135deg, #ff5722, #f50);
            color: white;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
        }
        
        .price-amount {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .price-label {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section h2 {
            color: #ff5722;
            font-size: 20px;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .feature-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            text-align: center;
        }
        
        .feature-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        
        .feature-value {
            font-size: 16px;
            font-weight: 600;
            color: #333;
        }
        
        .photos-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .photo-item {
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .photo-item img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }
        
        .credit-analysis {
            background: #e8f5e8;
            padding: 25px;
            border-radius: 12px;
            border: 2px solid #c8e6c9;
            margin-bottom: 30px;
        }
        
        .credit-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .credit-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        
        .credit-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        }
        
        .credit-value {
            font-size: 18px;
            font-weight: bold;
            color: #2e7d32;
        }
        
        .estimations-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .estimations-table th,
        .estimations-table td {
            padding: 12px;
            text-align: center;
            border-bottom: 1px solid #e9ecef;
        }
        
        .estimations-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }
        
        .estimations-table tr:hover {
            background: #f8f9fa;
        }
        
        .map-container {
            text-align: center;
            margin: 20px 0;
        }
        
        .map-container img {
            max-width: 100%;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .description {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #ff5722;
            margin: 20px 0;
        }
        
        .footer {
            text-align: center;
            padding: 20px 0;
            border-top: 1px solid #e9ecef;
            margin-top: 40px;
            color: #666;
            font-size: 14px;
        }
        
        .disclaimer {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 14px;
            color: #856404;
        }
        
        @media print {
            body {
                background: white;
            }
            .container {
                box-shadow: none;
                padding: 0;
            }
            .photos-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff5722;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(255, 87, 34, 0.3);
            z-index: 1000;
        }
        
        .print-button:hover {
            background: #d84315;
        }
        
        @media print {
            .print-button {
                display: none;
            }
        }
    </style>
</head>
<body>
    <button class="print-button" onclick="window.print()">🖨️ Imprimir</button>
    
    <div class="container">
        <div class="header">
            <h1>📊 Reporte de Propiedad</h1>
            <div class="subtitle">Generado el ${currentDate} por ZonaProp Estimador de Créditos</div>
        </div>
        
        <div class="property-info">
            <div class="main-info">
                <h2>📍 Información Principal</h2>
                <h3 style="color: #333; margin-bottom: 10px;">${property.titulo || 'Título no disponible'}</h3>
                <p style="color: #666; margin-bottom: 15px;">${property.ubicacion || 'Ubicación no disponible'}</p>
                
                ${property.codigo ? `<p><strong>Código:</strong> ${property.codigo}</p>` : ''}
                ${property.fechaPublicacion ? `<p><strong>Publicado:</strong> ${property.fechaPublicacion}</p>` : ''}
                ${property.inmobiliaria ? `<p><strong>Inmobiliaria:</strong> ${property.inmobiliaria}</p>` : ''}
                
                <p style="margin-top: 15px; font-size: 14px; color: #666;">
                    <strong>URL:</strong> <a href="${property.url}" style="color: #ff5722;">${property.url}</a>
                </p>
            </div>
            
            <div class="price-box">
                <div class="price-amount">USD ${property.precio ? property.precio.toLocaleString() : 'N/A'}</div>
                <div class="price-label">Precio de la propiedad</div>
                ${dollarRate ? `<div style="margin-top: 10px; font-size: 14px;">Aprox. $${property.precio ? (property.precio * creditData.dollarRate).toLocaleString() : 'N/A'}</div>` : ''}
            </div>
        </div>
        
        <div class="section">
            <h2>🏠 Características</h2>
            <div class="features-grid">
                ${Object.entries(property.caracteristicas).map(([key, value]) => `
                    <div class="feature-item">
                        <div class="feature-label">${key.replace(/([A-Z])/g, ' $1').toLowerCase()}</div>
                        <div class="feature-value">${value}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        ${property.descripcion ? `
        <div class="section">
            <h2>📝 Descripción</h2>
            <div class="description">
                ${property.descripcion}
            </div>
        </div>
        ` : ''}
        
        ${property.fotos.length > 0 ? `
        <div class="section">
            <h2>📸 Fotos de la Propiedad</h2>
            <div class="photos-grid">
                ${property.fotos.slice(0, 6).map(foto => `
                    <div class="photo-item">
                        <img src="${foto.url}" alt="${foto.alt}" onerror="this.style.display='none'">
                    </div>
                `).join('')}
            </div>
            ${property.fotos.length > 6 ? `<p style="text-align: center; color: #666; margin-top: 10px;">Y ${property.fotos.length - 6} fotos más...</p>` : ''}
        </div>
        ` : ''}
        
        ${property.mapa ? `
        <div class="section">
            <h2>🗺️ Ubicación</h2>
            <div class="map-container">
                <img src="${property.mapa}" alt="Mapa de la propiedad" onerror="this.style.display='none'">
            </div>
        </div>
        ` : ''}
        
        ${creditData.estimaciones.length > 0 ? `
        <div class="section">
            <h2>💰 Análisis de Crédito Hipotecario</h2>
            <div class="credit-analysis">
                <div class="credit-summary">
                    <div class="credit-item">
                        <div class="credit-label">Anticipo configurado</div>
                        <div class="credit-value">USD ${creditData.anticipo.toLocaleString()}</div>
                    </div>
                    <div class="credit-item">
                        <div class="credit-label">Monto del crédito</div>
                        <div class="credit-value">USD ${creditData.montoCredito.toLocaleString()}</div>
                    </div>
                    <div class="credit-item">
                        <div class="credit-label">En pesos argentinos</div>
                        <div class="credit-value">$${creditData.montoCreditoPesos.toLocaleString()}</div>
                    </div>
                    <div class="credit-item">
                        <div class="credit-label">TNA configurada</div>
                        <div class="credit-value">${creditData.tna}%</div>
                    </div>
                    <div class="credit-item">
                        <div class="credit-label">Dólar oficial</div>
                        <div class="credit-value">$${creditData.dollarRate.toLocaleString()}</div>
                    </div>
                </div>
                
                <h3 style="margin: 20px 0 15px 0; color: #2e7d32;">Estimaciones de Cuotas Mensuales</h3>
                <table class="estimations-table">
                    <thead>
                        <tr>
                            <th>Plazo</th>
                            <th>Cuota Mensual</th>
                            <th>Total a Pagar</th>
                            <th>Intereses</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${creditData.estimaciones.map(est => {
                            const totalAPagar = est.cuotaMensual * est.plazo * 12;
                            const intereses = totalAPagar - creditData.montoCreditoPesos;
                            return `
                                <tr>
                                    <td><strong>${est.plazo} años</strong></td>
                                    <td><strong>$${est.cuotaMensual.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
                                    <td>$${totalAPagar.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td>$${intereses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
        
        <div class="disclaimer">
            <strong>⚠️ Importante:</strong> Las estimaciones son aproximadas y solo con fines informativos. 
            Los valores reales pueden variar según las condiciones del banco, seguros, gastos administrativos 
            y otros factores. Siempre consulte con su entidad financiera para obtener información precisa.
        </div>
        
        <div class="footer">
            <p>Reporte generado por <strong>ZonaProp Estimador de Créditos Hipotecarios</strong></p>
            <p>Fecha: ${currentDate} | Datos obtenidos de: ${property.url}</p>
        </div>
    </div>
</body>
</html>`;
    }

    // Función para mostrar el modal de estimación
    async function showEstimationModal() {
        // Obtener configuración del storage
        const config = await chrome.storage.sync.get(['anticipo', 'tna']);
        currentConfig.anticipo = config.anticipo || DEFAULT_CONFIG.anticipo;
        currentConfig.tna = config.tna || DEFAULT_CONFIG.tna;

        // Obtener cotización del dólar
        if (!dollarRate) {
            await getDollarRate();
        }

        // Crear el modal
        const modal = document.createElement('div');
        modal.id = 'zp-estimator-modal';
        modal.innerHTML = `
            <div class="zp-modal-content">
                <div class="zp-modal-header">
                    <h3>Estimación de Crédito Hipotecario</h3>
                    <button class="zp-close-btn" onclick="this.closest('#zp-estimator-modal').remove()">×</button>
                </div>
                <div class="zp-modal-body">
                    <div class="zp-property-info">
                        <p><strong>Valor de la propiedad:</strong> USD ${currentPropertyPrice.toLocaleString()}</p>
                        <p><strong>Dólar oficial:</strong> $${dollarRate.toLocaleString()}</p>
                    </div>
                    <div class="zp-input-section">
                        <label for="anticipo-input">Anticipo disponible (USD):</label>
                        <input type="number" id="anticipo-input" value="${currentConfig.anticipo}" min="0" step="1000">
                    </div>
                    <div class="zp-input-section">
                        <label for="tna-input">TNA (%):</label>
                        <input type="number" id="tna-input" value="${currentConfig.tna}" min="0" max="100" step="0.1">
                    </div>
                    <button class="zp-calculate-btn" onclick="calculateEstimations()">Calcular Estimaciones</button>
                    <div id="zp-results" style="display: none;"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Agregar event listeners para cálculo en tiempo real
        document.getElementById('anticipo-input').addEventListener('input', calculateEstimations);
        document.getElementById('tna-input').addEventListener('input', calculateEstimations);
        
        // Calcular automáticamente
        calculateEstimations();
    }

    // Función para calcular las estimaciones
    window.calculateEstimations = function() {
        const anticipo = parseFloat(document.getElementById('anticipo-input').value) || 0;
        const tna = parseFloat(document.getElementById('tna-input').value) || DEFAULT_CONFIG.tna;
        
        const montoCredito = currentPropertyPrice - anticipo;
        const montoCreditoPesos = montoCredito * dollarRate;
        
        if (montoCredito <= 0) {
            document.getElementById('zp-results').innerHTML = '<p class="zp-error">El anticipo no puede ser mayor al valor de la propiedad.</p>';
            document.getElementById('zp-results').style.display = 'block';
            return;
        }
        
        const plazos = [5, 10, 15];
        let resultsHTML = `
            <div class="zp-credit-info">
                <p><strong>Monto del crédito:</strong></p>
                <p>USD ${montoCredito.toLocaleString()} = $${montoCreditoPesos.toLocaleString()}</p>
            </div>
            <div class="zp-estimations">
                <h4>Cuotas mensuales estimadas:</h4>
        `;
        
        plazos.forEach(plazo => {
            const cuotaMensual = calculateMonthlyPayment(montoCreditoPesos, tna, plazo);
            resultsHTML += `
                <div class="zp-estimation-item">
                    <div class="zp-plazo">${plazo} años</div>
                    <div class="zp-cuota">$${cuotaMensual.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                </div>
            `;
        });
        
        resultsHTML += `
            </div>
            <div class="zp-disclaimer">
                <p><small>* Estimación aproximada. TNA: ${tna}%. Consulte con su banco para condiciones reales.</small></p>
            </div>
        `;
        
        document.getElementById('zp-results').innerHTML = resultsHTML;
        document.getElementById('zp-results').style.display = 'block';
        
        // Guardar configuración
        chrome.storage.sync.set({
            anticipo: anticipo,
            tna: tna
        });
    };

    // Función para insertar los botones en la página
    function insertButtons() {
        // Buscar el contenedor del precio
        const priceContainer = document.querySelector('#article-container .posting-price, #article-container .price-container-property');
        
        if (priceContainer && !document.getElementById('zonaprop-credit-estimator')) {
            const estimatorButton = createEstimationButton();
            const reportButton = createReportButton();
            
            // Insertar los botones después del precio
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'zp-button-container';
            buttonContainer.appendChild(estimatorButton);
            buttonContainer.appendChild(reportButton);
            
            priceContainer.appendChild(buttonContainer);
        }
    }

    // Función principal de inicialización
    async function init() {
        // Extraer precio de la propiedad
        currentPropertyPrice = extractPropertyPrice();
        
        if (currentPropertyPrice) {
            console.log('Precio detectado:', currentPropertyPrice, 'USD');
            
            // Obtener cotización del dólar
            await getDollarRate();
            
            // Insertar botones
            insertButtons();
        } else {
            console.log('No se pudo detectar el precio de la propiedad');
        }
    }

    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Observer para detectar cambios dinámicos en la página
    const observer = new MutationObserver(() => {
        if (currentPropertyPrice && !document.getElementById('zonaprop-credit-estimator')) {
            insertButtons();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Listener para mensajes del popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'showEstimationModal') {
            if (currentPropertyPrice) {
                showEstimationModal();
                sendResponse({success: true});
            } else {
                sendResponse({success: false, error: 'No se detectó precio de propiedad'});
            }
        }
    });

})(); 