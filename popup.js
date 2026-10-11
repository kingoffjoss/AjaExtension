document.addEventListener('DOMContentLoaded', () => {
    const btnToggle = document.getElementById('btn-toggle');
    const btnReload = document.getElementById('btn-reload');
    const btnAdmin = document.getElementById('btn-admin');
    const statusIndicator = document.getElementById('status-indicator');

    let isEnabled = true;

    function isGenesysUrl(url) {
        return typeof url === 'string' && (
            url.includes('purecloud') ||
            url.includes('genesyscloud') ||
            url.includes('pure.cloud')
        );
    }

    function updateUI() {
        if (isEnabled) {
            btnToggle.innerText = 'Desativar Script';
            statusIndicator.style.background = '#10b981'; // Green
        } else {
            btnToggle.innerText = 'Ativar Script';
            statusIndicator.style.background = '#ef4444'; // Red
        }
    }

    chrome.storage.local.get(['aja_extension_enabled'], function(result) {
        if (result.aja_extension_enabled !== undefined) {
            isEnabled = result.aja_extension_enabled;
        }
        updateUI();
    });

    btnToggle.addEventListener('click', () => {
        isEnabled = !isEnabled;
        chrome.storage.local.set({ aja_extension_enabled: isEnabled }, function() {
            updateUI();
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]?.id && isGenesysUrl(tabs[0].url)) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        });
    });

    btnReload.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]?.id && isGenesysUrl(tabs[0].url)) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
    });

    btnAdmin.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("admin.html") });
    });
});
