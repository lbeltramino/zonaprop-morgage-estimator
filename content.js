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

    // Función para insertar el botón en la página
    function insertEstimationButton() {
        // Buscar el contenedor del precio
        const priceContainer = document.querySelector('#article-container .posting-price, #article-container .price-container-property');
        
        if (priceContainer && !document.getElementById('zonaprop-credit-estimator')) {
            const button = createEstimationButton();
            
            // Insertar el botón después del precio
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'zp-button-container';
            buttonContainer.appendChild(button);
            
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
            
            // Insertar botón de estimación
            insertEstimationButton();
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
            insertEstimationButton();
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