document.addEventListener('DOMContentLoaded', async () => {
    const app = document.getElementById('app');

    const commonPath = '../components/common/';
    
    // Загружаем основное окно
    const windowResponse = await fetch(commonPath + 'window.html');
    const windowHtml = await windowResponse.text();
    app.innerHTML = windowHtml;
    
    const windowContainer = app.querySelector('.window');
    
    // Загружаем заголовок и вкладки
    const headerResponse = await fetch(commonPath + 'header.html');
    const headerHtml = await headerResponse.text();
    windowContainer.insertAdjacentHTML('beforeend', headerHtml);
    
    const tabsResponse = await fetch(commonPath + 'tabs.html');
    const tabsHtml = await tabsResponse.text();
    windowContainer.insertAdjacentHTML('beforeend', tabsHtml);
    
    // Инициализируем контейнер для контента вкладок
    const contentContainer = document.createElement('div');
    contentContainer.id = 'tab-content';
    windowContainer.appendChild(contentContainer);
    
    // Загружаем начальный контент (GPSS модель)
    loadTabContent('gpss-model');
    
    // Навешиваем обработчики на вкладки
    const tabs = windowContainer.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Снимаем активность со всех
            tabs.forEach(t => t.classList.remove('active'));
            // Делаем текущую активной
            tab.classList.add('active');
            // Загружаем контент
            const tabName = tab.getAttribute('data-tab');
            loadTabContent(tabName);
        });
    });
    
    // Функция загрузки контента вкладки
    async function loadTabContent(tabName) {
        let contentHtml = '';
        
        switch(tabName) {
            case 'gpss-model':
                const gpssModelResponse = await fetch(commonPath + 'gpss-model.html');
                contentHtml = await gpssModelResponse.text();
                break;
            case 'gpss-objects':
                const objectsResponse = await fetch(commonPath + 'table.html');
                contentHtml = await objectsResponse.text();
                break;
            case 'general':
                const generalResponse = await fetch(commonPath + 'general.html');
                contentHtml = await generalResponse.text();
                break;
            case 'inputs':
            case 'outputs':
            case 'parameters':
            case 'states':
                contentHtml = `<div style="padding: 20px; background: #f9f9f9; border: 1px solid #ddd; margin: 10px;">
                    <p>Контент вкладки "${tabName}" пока не реализован.</p>
                </div>`;
                break;
            default:
                contentHtml = '<div>Неизвестная вкладка</div>';
        }
        
        document.getElementById('tab-content').innerHTML = contentHtml;
    }
});