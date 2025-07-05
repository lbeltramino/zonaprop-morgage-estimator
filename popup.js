// ZonaProp Estimador de Créditos Hipotecarios - Popup Script

document.addEventListener('DOMContentLoaded', function() {
    const anticipoInput = document.getElementById('anticipo');
    const tnaInput = document.getElementById('tna');
    const saveBtn = document.getElementById('saveBtn');
    const testBtn = document.getElementById('testBtn');
    const statusDiv = document.getElementById('status');

    // Valores por defecto
    const defaultValues = {
        anticipo: 20000,
        tna: 4.5
    };

    // Cargar configuración guardada
    loadConfiguration();

    // Event listeners
    saveBtn.addEventListener('click', saveConfiguration);
    testBtn.addEventListener('click', testOnCurrentPage);

    // Función para cargar la configuración
    function loadConfiguration() {
        chrome.storage.sync.get(['anticipo', 'tna'], function(result) {
            anticipoInput.value = result.anticipo || defaultValues.anticipo;
            tnaInput.value = result.tna || defaultValues.tna;
        });
    }

    // Función para guardar la configuración
    function saveConfiguration() {
        const anticipo = parseFloat(anticipoInput.value) || defaultValues.anticipo;
        const tna = parseFloat(tnaInput.value) || defaultValues.tna;

        // Validaciones
        if (anticipo < 0) {
            showStatus('El anticipo no puede ser negativo', 'error');
            return;
        }

        if (tna < 0 || tna > 100) {
            showStatus('La TNA debe estar entre 0% y 100%', 'error');
            return;
        }

        // Guardar en storage
        chrome.storage.sync.set({
            anticipo: anticipo,
            tna: tna
        }, function() {
            showStatus('Configuración guardada correctamente', 'success');
            
            // Cerrar popup después de 1.5 segundos
            setTimeout(() => {
                window.close();
            }, 1500);
        });
    }

    // Función para probar en la página actual
    function testOnCurrentPage() {
        // Primero guardar la configuración
        saveConfiguration();

        // Luego verificar si estamos en una página de ZonaProp
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (currentTab.url.includes('zonaprop.com.ar/propiedades/')) {
                // Enviar mensaje al content script para mostrar el modal
                chrome.tabs.sendMessage(currentTab.id, {
                    action: 'showEstimationModal'
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        showStatus('Error: Recarga la página e intenta nuevamente', 'error');
                    } else {
                        showStatus('Modal activado en la página actual', 'success');
                        setTimeout(() => {
                            window.close();
                        }, 1000);
                    }
                });
            } else {
                showStatus('Debes estar en una página de propiedad de ZonaProp', 'error');
            }
        });
    }

    // Función para mostrar mensajes de estado
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.classList.remove('hidden');

        // Ocultar después de 3 segundos si es error
        if (type === 'error') {
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 3000);
        }
    }

    // Validación en tiempo real
    anticipoInput.addEventListener('input', function() {
        const value = parseFloat(this.value);
        if (value < 0) {
            this.style.borderColor = 'rgba(244, 67, 54, 0.8)';
        } else {
            this.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }
    });

    tnaInput.addEventListener('input', function() {
        const value = parseFloat(this.value);
        if (value < 0 || value > 100) {
            this.style.borderColor = 'rgba(244, 67, 54, 0.8)';
        } else {
            this.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }
    });

    // Atajos de teclado
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveConfiguration();
        }
        if (event.key === 'Escape') {
            window.close();
        }
    });
}); 