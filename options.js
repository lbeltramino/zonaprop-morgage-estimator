// ZonaProp Estimador de Créditos Hipotecarios - Options Script

document.addEventListener('DOMContentLoaded', function() {
    const anticipoInput = document.getElementById('anticipo');
    const tnaInput = document.getElementById('tna');
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusDiv = document.getElementById('status');

    // Valores por defecto
    const defaultValues = {
        anticipo: 20000,
        tna: 4.5
    };

    // Cargar configuración al iniciar
    loadConfiguration();

    // Event listeners
    saveBtn.addEventListener('click', saveConfiguration);
    resetBtn.addEventListener('click', resetToDefaults);

    // Función para cargar la configuración guardada
    function loadConfiguration() {
        chrome.storage.sync.get(['anticipo', 'tna'], function(result) {
            anticipoInput.value = result.anticipo || defaultValues.anticipo;
            tnaInput.value = result.tna || defaultValues.tna;
        });
    }

    // Función para guardar la configuración
    function saveConfiguration() {
        const anticipo = parseFloat(anticipoInput.value);
        const tna = parseFloat(tnaInput.value);

        // Validaciones
        if (isNaN(anticipo) || anticipo < 0) {
            showStatus('Error: El anticipo debe ser un número positivo', 'error');
            return;
        }

        if (isNaN(tna) || tna < 0 || tna > 100) {
            showStatus('Error: La TNA debe estar entre 0% y 100%', 'error');
            return;
        }

        // Guardar en storage
        chrome.storage.sync.set({
            anticipo: anticipo,
            tna: tna
        }, function() {
            if (chrome.runtime.lastError) {
                showStatus('Error al guardar la configuración', 'error');
            } else {
                showStatus('Configuración guardada correctamente', 'success');
            }
        });
    }

    // Función para restaurar valores por defecto
    function resetToDefaults() {
        anticipoInput.value = defaultValues.anticipo;
        tnaInput.value = defaultValues.tna;
        
        // Guardar los valores por defecto
        chrome.storage.sync.set({
            anticipo: defaultValues.anticipo,
            tna: defaultValues.tna
        }, function() {
            if (chrome.runtime.lastError) {
                showStatus('Error al restaurar valores por defecto', 'error');
            } else {
                showStatus('Valores por defecto restaurados correctamente', 'success');
            }
        });
    }

    // Función para mostrar mensajes de estado
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.classList.remove('hidden');

        // Ocultar mensaje después de 5 segundos
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }

    // Validación en tiempo real de los inputs
    anticipoInput.addEventListener('input', function() {
        const value = parseFloat(this.value);
        if (isNaN(value) || value < 0) {
            this.style.borderColor = '#dc3545';
        } else {
            this.style.borderColor = '#e0e0e0';
        }
    });

    tnaInput.addEventListener('input', function() {
        const value = parseFloat(this.value);
        if (isNaN(value) || value < 0 || value > 100) {
            this.style.borderColor = '#dc3545';
        } else {
            this.style.borderColor = '#e0e0e0';
        }
    });

    // Guardar automáticamente cuando se cambian los valores (con debounce)
    let saveTimeout;
    function autoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const anticipo = parseFloat(anticipoInput.value);
            const tna = parseFloat(tnaInput.value);
            
            if (!isNaN(anticipo) && anticipo >= 0 && !isNaN(tna) && tna >= 0 && tna <= 100) {
                chrome.storage.sync.set({
                    anticipo: anticipo,
                    tna: tna
                });
            }
        }, 1000); // Guardar 1 segundo después de dejar de escribir
    }

    anticipoInput.addEventListener('input', autoSave);
    tnaInput.addEventListener('input', autoSave);

    // Atajos de teclado
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            saveConfiguration();
        }
        if (event.ctrlKey && event.key === 'r') {
            event.preventDefault();
            resetToDefaults();
        }
    });
}); 