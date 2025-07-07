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

    // Función para detectar el tipo de página
    function detectPageType() {
        const url = window.location.href;
        
        console.log('🔍 Detectando tipo de página:', {
            url: url
        });
        
        // Detectar páginas individuales primero (tienen prioridad)
        if (url.includes('/propiedades/')) {
            return 'individual';
        }
        
        // Detectar páginas de listado por URL - cualquier URL que contenga "venta"
        if (url.includes('zonaprop.com.ar/') && url.includes('venta')) {
            return 'listing';
        }
        
        // También detectar otros patrones específicos de listado
        if (url.startsWith('https://www.zonaprop.com.ar/departamentos-venta-') ||
            url.startsWith('https://www.zonaprop.com.ar/casas-venta-')) {
            return 'listing';
        }
        
        // Fallback: detectar por elementos DOM
        const articleContainer = document.querySelector('#article-container');
        if (articleContainer) {
            return 'individual';
        }
        
        // Si hay múltiples tarjetas de propiedades, es una página de listados
        const listingContainer = document.querySelector('.postingsList-module__postings-container');
        const propertyCards = document.querySelectorAll('[class*="postingCard"], [class*="posting-card"]');
        
        if (listingContainer && propertyCards.length > 1) {
            return 'listing';
        }
        
        return 'unknown';
    }

    // Función para buscar precios en listados
    function findPricesInListings() {
        const prices = [];
        
        // Buscar específicamente en las tarjetas de propiedad
        const propertyCards = document.querySelectorAll('[class*="postingCard"], [class*="posting-card"], [class*="listing-card"]');
        
        console.log('🏷️ Buscando precios en', propertyCards.length, 'tarjetas de propiedad');
        
        // Buscar todos los elementos que contengan precios en formato USD
        const pricePattern = /USD\s*([\d.,]+)/i;
        
        // Primero buscar en las tarjetas de propiedad
        propertyCards.forEach((card, index) => {
            const priceElements = card.querySelectorAll('*');
            
            for (const element of priceElements) {
                // Solo considerar elementos que contengan texto directamente
                if (element.children.length === 0 && element.textContent.trim()) {
                    const text = element.textContent.trim();
                    const match = text.match(pricePattern);
                    
                    if (match) {
                        // Verificar que sea realmente un precio de propiedad (no otros textos)
                        const priceValue = parseFloat(match[1].replace(/[.,]/g, '').replace(/\./g, ''));
                        if (priceValue > 1000 && priceValue < 10000000) { // Rango razonable de precios
                            // Verificar que no hayamos agregado ya un precio para esta tarjeta
                            const alreadyExists = prices.some(p => p.container === card);
                            if (!alreadyExists) {
                                prices.push({
                                    element: element,
                                    container: card,
                                    price: priceValue,
                                    text: text
                                });
                                console.log(`💰 Precio encontrado en tarjeta ${index + 1}: ${text} (${priceValue})`);
                                break; // Solo tomar el primer precio válido por tarjeta
                            }
                        }
                    }
                }
            }
        });
        
        // Si no encontramos precios en las tarjetas, buscar en toda la página
        if (prices.length === 0) {
            console.log('🔍 No se encontraron precios en tarjetas, buscando en toda la página...');
            
            const allElements = document.querySelectorAll('*');
            for (const element of allElements) {
                if (element.children.length === 0 && element.textContent.trim()) {
                    const text = element.textContent.trim();
                    const match = text.match(pricePattern);
                    
                    if (match) {
                        const priceValue = parseFloat(match[1].replace(/[.,]/g, '').replace(/\./g, ''));
                        if (priceValue > 1000 && priceValue < 10000000) {
                            // Buscar el contenedor de la tarjeta de propiedad
                            let priceContainer = element.closest('[class*="posting"], [class*="card"], [class*="property"]');
                            if (priceContainer) {
                                // Verificar que no hayamos agregado ya un precio para esta tarjeta
                                const alreadyExists = prices.some(p => p.container === priceContainer);
                                if (!alreadyExists) {
                                    prices.push({
                                        element: element,
                                        container: priceContainer,
                                        price: priceValue,
                                        text: text
                                    });
                                    console.log(`💰 Precio encontrado globalmente: ${text} (${priceValue})`);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        console.log('🏷️ Total de precios encontrados:', prices.length);
        return prices;
    }

    // Función para buscar precios en página individual
    function findPriceInIndividualPage() {
        // Usando el xpath proporcionado
        const xpath = '//*[@id="article-container"]/div[1]/div/div[1]/span[1]/span/text()';
        
        try {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
                const priceText = result.singleNodeValue.textContent.trim();
                const priceMatch = priceText.match(/USD\s*([\d.,]+)/i);
                if (priceMatch) {
                    const price = parseFloat(priceMatch[1].replace(/[.,]/g, ''));
                    return {
                        element: result.singleNodeValue.parentElement,
                        price: price,
                        text: priceText
                    };
                }
            }
        } catch (error) {
            console.log('Error usando XPath, intentando con selectores alternativos');
        }

        // Métodos alternativos para páginas individuales
        const selectors = [
            '#article-container .posting-price',
            '#article-container .price-container-property',
            '#article-container [class*="price"]',
            '.property-price',
            '.price-value'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent.trim();
                const priceMatch = text.match(/USD\s*([\d.,]+)/i);
                if (priceMatch) {
                    const price = parseFloat(priceMatch[1].replace(/[.,]/g, ''));
                    return {
                        element: element,
                        price: price,
                        text: text
                    };
                }
            }
        }
        
        return null;
    }

    // Función para extraer el precio de la propiedad
    function extractPropertyPrice() {
        const pageType = detectPageType();
        
        if (pageType === 'individual') {
            const priceData = findPriceInIndividualPage();
            return priceData ? priceData.price : null;
        }
        
        // Para listados, tomamos el primer precio encontrado como referencia
        const prices = findPricesInListings();
        return prices.length > 0 ? prices[0].price : null;
    }

    // Función para expandir la descripción completa
    function expandDescription() {
        try {
            console.log('🔍 Buscando botón para expandir descripción...');
            
            // Buscar todos los botones que puedan expandir descripción
            const allButtons = document.querySelectorAll('button');
            
            for (const button of allButtons) {
                const buttonText = button.textContent.toLowerCase().trim();
                
                if (buttonText.includes('leer descripción completa') || 
                    buttonText.includes('ver más descripción') ||
                    buttonText.includes('expandir descripción') ||
                    (buttonText.includes('leer') && buttonText.includes('descripción'))) {
                    
                    console.log('🔍 Expandiendo descripción completa...', buttonText);
                    button.click();
                    
                    // Esperar un poco para que se expanda
                    return new Promise(resolve => {
                        setTimeout(() => {
                            console.log('✅ Descripción expandida');
                            resolve(true);
                        }, 200);
                    });
                }
            }
            
            // Si no encontramos el botón, buscar por atributos específicos
            const ariaButtons = document.querySelectorAll('button[aria-expanded="false"]');
            for (const button of ariaButtons) {
                const buttonText = button.textContent.toLowerCase().trim();
                if (buttonText.includes('descripción') || buttonText.includes('leer')) {
                    console.log('🔍 Expandiendo descripción (aria-expanded)...', buttonText);
                    button.click();
                    
                    return new Promise(resolve => {
                        setTimeout(() => {
                            console.log('✅ Descripción expandida');
                            resolve(true);
                        }, 200);
                    });
                }
            }
            
            console.log('❌ No se encontró botón para expandir descripción');
            return Promise.resolve(false);
            
        } catch (error) {
            console.error('❌ Error al expandir descripción:', error);
            return Promise.resolve(false);
        }
    }

    // Función para extraer todos los datos de la propiedad
    async function extractPropertyData() {
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

        // Expandir descripción completa si es necesario
        await expandDescription();

        // Extraer precio
        data.precio = extractPropertyPrice();

        // Extraer título - versión mejorada con más selectores
        const titleSelectors = [
            'h1.title-type-sup',
            '.title-type-sup',
            '.section-title h1',
            '.section-title .title-type-sup',
            '.title-container h1',
            '.property-title',
            '.listing-title',
            'h1'
        ];
        
        for (const selector of titleSelectors) {
            const titleElement = document.querySelector(selector);
            if (titleElement && titleElement.textContent.trim()) {
                data.titulo = titleElement.textContent.trim();
                break;
            }
        }

        // Extraer ubicación - versión mejorada con más selectores
        const locationSelectors = [
            '.title-location',
            '.section-location', 
            '.info-location',
            '.location-text',
            '.location-address',
            '.address-container',
            '.property-location',
            '.location-info',
            '.address-info',
            '.location-data',
            '.property-address',
            '.address-section',
            '.ubicacion-propiedad',
            '.direccion-propiedad',
            '.address-details',
            '.location-container',
            '.posting-location',
            '.article-location'
        ];
        
        for (const selector of locationSelectors) {
            const locationElement = document.querySelector(selector);
            if (locationElement && locationElement.textContent.trim()) {
                data.ubicacion = locationElement.textContent.trim();
                break;
            }
        }
        
        // Si no encontramos ubicación, buscar en datos estructurados
        if (!data.ubicacion) {
            const scriptTags = document.querySelectorAll('script[type="application/ld+json"], script');
            for (let script of scriptTags) {
                const content = script.textContent;
                if (content.includes('"address"') || content.includes('"location"')) {
                    try {
                        const jsonData = JSON.parse(content);
                        if (jsonData.address) {
                            data.ubicacion = typeof jsonData.address === 'string' ? jsonData.address : 
                                           jsonData.address.streetAddress || jsonData.address.name || '';
                            break;
                        }
                    } catch (e) {
                        // Buscar dirección en texto plano del script
                        const addressMatch = content.match(/"address":\s*"([^"]+)"/);
                        if (addressMatch) {
                            data.ubicacion = addressMatch[1];
                            break;
                        }
                    }
                }
            }
        }

        // Extraer descripción - versión mejorada con más selectores
        const descriptionSelectors = [
            '#verDatosDescripcion',
            '.section-description',
            '.descriptionContent',
            '.description-container',
            '.property-description',
            '.listing-description',
            '.description-text',
            '.description-section',
            '.article-description',
            '.property-details-description',
            '.posting-description',
            '.full-description',
            '.descripcion-contenido',
            '.descripcion-texto',
            '.datos-descripcion'
        ];
        
        for (const selector of descriptionSelectors) {
            const descriptionElement = document.querySelector(selector);
            if (descriptionElement && descriptionElement.textContent.trim()) {
                data.descripcion = descriptionElement.textContent.trim();
                break;
            }
        }
        
        // Si no encontramos descripción, buscar en scripts JSON-LD o datos estructurados
        if (!data.descripcion) {
            const scriptTags = document.querySelectorAll('script[type="application/ld+json"], script');
            for (let script of scriptTags) {
                const content = script.textContent;
                if (content.includes('"description"') || content.includes('"descripcion"')) {
                    try {
                        const jsonData = JSON.parse(content);
                        if (jsonData.description) {
                            data.descripcion = jsonData.description;
                            break;
                        }
                    } catch (e) {
                        // Buscar descripción en texto plano del script
                        const descMatch = content.match(/"description":\s*"([^"]+)"/);
                        if (descMatch) {
                            data.descripcion = descMatch[1];
                            break;
                        }
                    }
                }
            }
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

        // Extraer código de propiedad - versión mejorada con más selectores
        const codeSelectors = [
            '.publisher-code',
            '.codigo-propiedad',
            '.property-code',
            '.listing-code',
            '.code-container',
            '.property-id',
            '.listing-id'
        ];
        
        for (const selector of codeSelectors) {
            const codeElement = document.querySelector(selector);
            if (codeElement && codeElement.textContent.trim()) {
                data.codigo = codeElement.textContent.trim();
                break;
            }
        }

        // Si no encontramos código, intentar extraer de la URL
        if (!data.codigo) {
            const urlMatch = window.location.href.match(/(\d{8,})/);
            if (urlMatch) {
                data.codigo = urlMatch[1];
            }
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

    // Función para calcular la cuota mensual
    function calculateMonthlyPayment(principal, annualRate, years) {
        if (annualRate === 0) {
            return principal / (years * 12);
        }
        
        const monthlyRate = annualRate / 100 / 12;
        const numPayments = years * 12;
        
        const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                              (Math.pow(1 + monthlyRate, numPayments) - 1);
        
        return monthlyPayment;
    }

    // Función para crear el botón de estimación
    function createEstimationButton() {
        const button = document.createElement('button');
        button.className = 'zonaprop-loan-button';
        button.textContent = 'Estimar Crédito';
        return button;
    }

    // Función para crear el botón de reporte
    function createReportButton() {
        const button = document.createElement('button');
        button.className = 'zonaprop-report-button';
        button.textContent = 'Generar Reporte';
        return button;
    }

    // Función para extraer datos de una tarjeta específica en listados
    function extractPropertyDataFromCard(cardElement, price) {
        const data = {
            precio: price,
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

        // Extraer ID de la propiedad
        const propertyId = cardElement.getAttribute('data-id');
        if (propertyId) {
            data.codigo = propertyId;
        }

        // Extraer título/descripción del enlace principal
        const descriptionLink = cardElement.querySelector('a[href*="/propiedades/"]');
        if (descriptionLink) {
            data.descripcion = descriptionLink.textContent.trim();
            // Extraer URL de la propiedad individual
            const relativeUrl = descriptionLink.getAttribute('href');
            if (relativeUrl) {
                data.url = 'https://www.zonaprop.com.ar' + relativeUrl;
            }
        }

        // Extraer información adicional del card para crear un título más descriptivo
        const propertyTypeElements = cardElement.querySelectorAll('[class*="property-type"], [class*="operation-type"], [class*="posting-type"]');
        const operationType = [];
        const propertyType = [];
        
        propertyTypeElements.forEach(element => {
            const text = element.textContent.trim();
            if (text.includes('venta') || text.includes('alquiler')) {
                operationType.push(text);
            } else if (text.includes('Departamento') || text.includes('Casa') || text.includes('PH')) {
                propertyType.push(text);
            }
        });
        
        // También buscar en el texto de la descripción para extraer tipo de propiedad
        if (data.descripcion) {
            if (data.descripcion.toLowerCase().includes('departamento') && propertyType.length === 0) {
                propertyType.push('Departamento');
            } else if (data.descripcion.toLowerCase().includes('casa') && propertyType.length === 0) {
                propertyType.push('Casa');
            } else if (data.descripcion.toLowerCase().includes('ph') && propertyType.length === 0) {
                propertyType.push('PH');
            }
            
            if (data.descripcion.toLowerCase().includes('venta') && operationType.length === 0) {
                operationType.push('venta');
            } else if (data.descripcion.toLowerCase().includes('alquiler') && operationType.length === 0) {
                operationType.push('alquiler');
            }
        }

        // Extraer ubicación
        const addressElement = cardElement.querySelector('[class*="location-address"]');
        const locationElement = cardElement.querySelector('[class*="location-text"]');
        if (addressElement || locationElement) {
            const address = addressElement ? addressElement.textContent.trim() : '';
            const location = locationElement ? locationElement.textContent.trim() : '';
            data.ubicacion = address + (address && location ? ', ' : '') + location;
        }

        // Extraer características principales
        const featuresElements = cardElement.querySelectorAll('[class*="main-features"] span');
        featuresElements.forEach(feature => {
            const text = feature.textContent.trim();
            if (text.includes('m²')) {
                if (text.includes('tot')) {
                    data.caracteristicas.superficieTotal = text;
                } else if (text.includes('cub')) {
                    data.caracteristicas.superficieCubierta = text;
                }
            } else if (text.includes('amb')) {
                data.caracteristicas.ambientes = text;
            } else if (text.includes('dorm')) {
                data.caracteristicas.dormitorios = text;
            } else if (text.includes('baño')) {
                data.caracteristicas.banos = text;
            } else if (text.includes('coch')) {
                data.caracteristicas.cochera = text;
            }
        });

        // Extraer fotos de la galería
        const galleryImages = cardElement.querySelectorAll('img[src*="zonapropcdn"]');
        galleryImages.forEach(img => {
            if (img.src && img.src.includes('zonapropcdn') && !img.src.includes('logo')) {
                // Convertir a URL de alta calidad
                let photoUrl = img.src;
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

        // Extraer información de inmobiliaria
        const publisherElement = cardElement.querySelector('[class*="publisher"] img[alt*="logo"]');
        if (publisherElement) {
            data.inmobiliaria = publisherElement.alt.replace('logo publisher', '').trim();
        }

        // Crear título descriptivo CONCISO (como el original que funcionaba bien)
        const titleParts = [];
        
        // Agregar tipo de propiedad
        if (propertyType.length > 0) {
            titleParts.push(propertyType[0]);
        } else {
            titleParts.push('Departamento'); // Default
        }
        
        // Agregar superficie
        if (data.caracteristicas.superficieTotal) {
            titleParts.push(data.caracteristicas.superficieTotal);
        } else if (data.caracteristicas.superficieCubierta) {
            titleParts.push(data.caracteristicas.superficieCubierta);
        }
        
        // Agregar ambientes
        if (data.caracteristicas.ambientes) {
            titleParts.push(data.caracteristicas.ambientes);
        }
        
        // Agregar tipo de operación
        if (operationType.length > 0) {
            titleParts.push(operationType[0]);
        }
        
        // Agregar SOLO palabras clave de la descripción, no toda la descripción
        if (data.descripcion) {
            // Extraer solo palabras clave importantes (máximo 5 palabras)
            const keyWords = data.descripcion
                .toLowerCase()
                .match(/\b(balcón|terraza|cochera|pileta|parrilla|quincho|jardín|patio|reciclado|nuevo|estrenar|luminoso|amplio)\b/g);
            
            if (keyWords && keyWords.length > 0) {
                // Tomar solo las primeras 2-3 palabras clave únicas
                const uniqueKeyWords = [...new Set(keyWords)].slice(0, 2);
                titleParts.push(...uniqueKeyWords.map(word => word.charAt(0).toUpperCase() + word.slice(1)));
            }
        }
        
        // Agregar ubicación (solo la parte final)
        if (data.ubicacion) {
            const locationParts = data.ubicacion.split(',');
            if (locationParts.length > 0) {
                titleParts.push(locationParts[locationParts.length - 1].trim());
            }
        }
        
        // Unir todas las partes del título con el separador
        data.titulo = titleParts.filter(part => part && part.trim()).join(' · ');
        
        // Si no tenemos título aún, usar solo primeras palabras de la descripción
        if (!data.titulo && data.descripcion) {
            const shortDescription = data.descripcion.split(' ').slice(0, 6).join(' ');
            data.titulo = shortDescription;
        }
        
        // Último recurso: título básico
        if (!data.titulo) {
            const ambientes = data.caracteristicas.ambientes || '';
            const superficie = data.caracteristicas.superficieTotal || '';
            data.titulo = `Departamento ${superficie} ${ambientes}`.trim();
        }

        console.log('📋 Datos extraídos de la tarjeta:', data);
        return data;
    }

    // Función para obtener el mapa de la página individual
    async function fetchMapFromIndividualPage(propertyUrl) {
        try {
            console.log('🗺️ Obteniendo mapa desde página individual:', propertyUrl);
            
            const response = await fetch(propertyUrl);
            const html = await response.text();
            
            // Crear un DOM parser para analizar el HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Buscar el mapa con selectores más específicos
            const mapSelectors = [
                '.static-map img',
                '.article-map img', 
                '.map-container img',
                'img[src*="maps.google.com"]',
                'img[src*="staticmap"]',
                'img[src*="maps.googleapis.com"]',
                '.map-section img',
                '.location-map img',
                '.property-map img'
            ];
            
            for (const selector of mapSelectors) {
                const mapElement = doc.querySelector(selector);
                if (mapElement && mapElement.src && 
                    (mapElement.src.includes('maps.google.com') || 
                     mapElement.src.includes('staticmap') || 
                     mapElement.src.includes('maps.googleapis.com'))) {
                    console.log('✅ Mapa encontrado:', mapElement.src);
                    return mapElement.src;
                }
            }
            
            // Si no encontramos con selectores, buscar en el HTML directamente
            const mapUrlMatch = html.match(/https:\/\/maps\.google\.com\/maps\/api\/staticmap[^"']*/);
            if (mapUrlMatch) {
                console.log('✅ Mapa encontrado en HTML:', mapUrlMatch[0]);
                return mapUrlMatch[0];
            }
            
            console.log('❌ No se encontró mapa en la página individual');
            return null;
        } catch (error) {
            console.error('❌ Error al obtener el mapa:', error);
            return null;
        }
    }

    // Función para generar reporte desde una tarjeta de listado
    async function generatePropertyReportFromCard(cardElement, price) {
        console.log('📄 Generando reporte desde tarjeta de listado...');
        
        // Extraer datos específicos de la tarjeta
        propertyData = extractPropertyDataFromCard(cardElement, price);
        
        if (!propertyData.precio) {
            alert('No se pudo obtener el precio de la propiedad');
            return;
        }

        // Obtener cotización del dólar si no la tenemos
        if (!dollarRate) {
            await getDollarRate();
        }

        // Obtener el mapa de la página individual (si tenemos URL)
        if (propertyData.url && propertyData.url.includes('propiedades/')) {
            console.log('🗺️ Obteniendo mapa desde la página individual...');
            
            // Mostrar indicador de carga más discreto
            const loadingIndicator = document.createElement('div');
            loadingIndicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(255, 87, 34, 0.9);
                color: white;
                padding: 10px 15px;
                border-radius: 20px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            loadingIndicator.innerHTML = '🗺️ Obteniendo mapa...';
            document.body.appendChild(loadingIndicator);
            
            try {
                propertyData.mapa = await fetchMapFromIndividualPage(propertyData.url);
            } finally {
                // Remover indicador de carga
                if (document.body.contains(loadingIndicator)) {
                    document.body.removeChild(loadingIndicator);
                }
            }
        }

        // Calcular estimaciones de crédito
        const creditData = await calculateCreditEstimations(propertyData.precio);

        // Generar el HTML del reporte
        const reportHTML = generateReportHTML(propertyData, creditData);

        // Abrir en nueva ventana
        const newWindow = window.open('', '_blank');
        newWindow.document.write(reportHTML);
        newWindow.document.close();

        console.log('✅ Reporte generado desde tarjeta de listado');
    }

    // Función para generar el reporte de la propiedad (páginas individuales)
    async function generatePropertyReport() {
        console.log('📄 Generando reporte desde página individual...');
        
        // Extraer datos de la propiedad
        propertyData = await extractPropertyData();
        
        if (!propertyData.precio) {
            alert('No se pudo obtener el precio de la propiedad');
            return;
        }

        // Obtener cotización del dólar si no la tenemos
        if (!dollarRate) {
            await getDollarRate();
        }

        // Calcular estimaciones de crédito
        const creditData = await calculateCreditEstimations(propertyData.precio);

        // Generar el HTML del reporte
        const reportHTML = generateReportHTML(propertyData, creditData);

        // Abrir en nueva ventana
        const newWindow = window.open('', '_blank');
        newWindow.document.write(reportHTML);
        newWindow.document.close();

        console.log('✅ Reporte generado desde página individual');
    }

    // Función para calcular estimaciones de crédito
    async function calculateCreditEstimations(propertyPrice) {
        // Obtener configuración
        const config = await chrome.storage.sync.get(['anticipo', 'tna']);
        const anticipo = config.anticipo || DEFAULT_CONFIG.anticipo;
        const tna = config.tna || DEFAULT_CONFIG.tna;

        const montoCredito = propertyPrice - anticipo;
        const montoCreditoPesos = montoCredito * dollarRate;
        
        const estimaciones = [5, 10, 15].map(plazo => ({
            plazo: plazo,
            cuotaMensual: calculateMonthlyPayment(montoCreditoPesos, tna, plazo)
        }));

        return {
            precioPropiedad: propertyPrice,
            anticipo: anticipo,
            montoCredito: montoCredito,
            montoCreditoPesos: montoCreditoPesos,
            dollarRate: dollarRate,
            tna: tna,
            estimaciones: estimaciones
        };
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
        const pageType = detectPageType();
        console.log('🔧 Insertando botones, tipo de página:', pageType);
        
        if (pageType === 'individual') {
            insertButtonsInIndividualPage();
        } else if (pageType === 'listing') {
            insertButtonsInListings();
        }
    }

    // Función para insertar botones en página individual
    function insertButtonsInIndividualPage() {
        // Buscar el contenedor del precio
        const priceData = findPriceInIndividualPage();
        if (!priceData || document.querySelector('.zonaprop-loan-button')) {
            return;
        }

        // Crear los botones
        const estimatorButton = createEstimationButton();
        const reportButton = createReportButton();
        
        // Agregar event listeners para páginas individuales
        estimatorButton.addEventListener('click', showEstimationModal);
        reportButton.addEventListener('click', generatePropertyReport);
        
        // Crear contenedor de botones
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'zp-button-container';
        buttonContainer.appendChild(estimatorButton);
        buttonContainer.appendChild(reportButton);
        
        // Insertar después del elemento de precio
        priceData.element.parentNode.insertBefore(buttonContainer, priceData.element.nextSibling);
        
        console.log('✅ Botones insertados en página individual');
    }

    // Función para insertar botones en listados
    function insertButtonsInListings() {
        const prices = findPricesInListings();
        console.log('🏷️ Insertando botones en', prices.length, 'propiedades');
        
        prices.forEach((priceInfo, index) => {
            // Verificar si ya hay botones en esta tarjeta
            if (priceInfo.container.querySelector('.zonaprop-loan-button')) {
                return;
            }

            // Crear los botones con el precio específico
            const estimatorButton = createEstimationButton();
            const reportButton = createReportButton();
            
            // Modificar los event listeners para usar el precio específico
            estimatorButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentPropertyPrice = priceInfo.price;
                showEstimationModal();
            });
            
            reportButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentPropertyPrice = priceInfo.price;
                generatePropertyReportFromCard(priceInfo.container, priceInfo.price);
            });
            
            // Crear contenedor de botones
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'zp-button-container-listing';
            buttonContainer.appendChild(estimatorButton);
            buttonContainer.appendChild(reportButton);
            
            // Buscar el mejor lugar para insertar los botones
            // Intentar insertar cerca del precio
            let insertTarget = priceInfo.element.parentElement;
            
            // Si el elemento padre directo del precio tiene clase relacionada con precio, usar ese
            if (insertTarget && insertTarget.className.includes('price')) {
                insertTarget.appendChild(buttonContainer);
            } else {
                // Si no, insertar después del elemento de precio
                priceInfo.element.parentNode.insertBefore(buttonContainer, priceInfo.element.nextSibling);
            }
            
            console.log(`✅ Botones insertados en propiedad ${index + 1}: USD ${priceInfo.price.toLocaleString()}`);
        });
    }

    // Función principal de inicialización
    async function init() {
        console.log('🚀 ZonaProp Estimador de Créditos v2.0 - Iniciando...');
        console.log('🌐 URL actual:', window.location.href);
        
        // Detectar tipo de página
        const pageType = detectPageType();
        console.log('📄 Tipo de página detectado:', pageType);
        
        if (pageType === 'unknown') {
            console.log('❌ Tipo de página no reconocido, terminando...');
            return;
        }
        
        // Obtener cotización del dólar
        try {
            await getDollarRate();
            console.log('💵 Dólar oficial obtenido:', dollarRate);
        } catch (error) {
            console.error('❌ Error obteniendo cotización del dólar:', error);
        }
        
        // Extraer precio de la propiedad para páginas individuales
        if (pageType === 'individual') {
            currentPropertyPrice = extractPropertyPrice();
            if (currentPropertyPrice) {
                console.log('💰 Precio detectado en página individual:', currentPropertyPrice, 'USD');
            } else {
                console.log('⚠️ No se pudo detectar precio en página individual');
            }
        }
        
        // Insertar botones inmediatamente
        console.log('🔧 Insertando botones...');
        insertButtons();
        
        // Para listados, configurar observer y retry automático
        if (pageType === 'listing') {
            setupListingObserver();
            
            // Retry automático cada 3 segundos para listados (máximo 5 veces)
            let retryCount = 0;
            const maxRetries = 5;
            const retryInterval = setInterval(() => {
                retryCount++;
                console.log(`🔄 Retry ${retryCount}/${maxRetries} para insertar botones en listado...`);
                
                insertButtons();
                
                if (retryCount >= maxRetries) {
                    clearInterval(retryInterval);
                    console.log('⏹️ Máximo de retries alcanzado');
                }
            }, 3000);
        }
        
        console.log('✅ Inicialización completa');
    }

    // Función para configurar observer específico para listados
    function setupListingObserver() {
        console.log('⏰ Configurando observer para listados...');
        
        // Buscar el contenedor de listados
        const listingContainer = document.querySelector('.postingsList-module__postings-container') || 
                                document.querySelector('[class*="postings-container"]') || 
                                document.querySelector('[class*="listings-container"]');
        
        if (!listingContainer) {
            console.log('❌ No se encontró contenedor de listados, configurando observer global');
            // Si no encontramos el contenedor específico, observar todo el body
            const bodyObserver = new MutationObserver((mutations) => {
                let shouldInsertButtons = false;
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        shouldInsertButtons = true;
                    }
                });
                
                if (shouldInsertButtons) {
                    setTimeout(() => {
                        insertButtonsInListings();
                    }, 1000);
                }
            });
            
            bodyObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            console.log('👀 Observer global configurado para listados');
            return;
        }
        
        console.log('✅ Contenedor de listados encontrado, configurando observer específico');
        
        const listingObserver = new MutationObserver((mutations) => {
            let shouldInsertButtons = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldInsertButtons = true;
                }
            });
            
            if (shouldInsertButtons) {
                // Esperar un poco para que se complete la carga
                setTimeout(() => {
                    insertButtonsInListings();
                }, 500);
            }
        });
        
        listingObserver.observe(listingContainer, {
            childList: true,
            subtree: true
        });
        
        console.log('👀 Observer específico configurado para listados');
        
        // También configurar un observer con retry para casos donde el contenido tarda en cargar
        setTimeout(() => {
            insertButtonsInListings();
        }, 2000);
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