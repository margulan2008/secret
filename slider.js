let currentIndex = 0;
const catalog = document.getElementById('catalog');
const items = Array.from(catalog.children);

function updateSlider() {
    items.forEach((item, i) => {
        item.classList.remove('active', 'left', 'right');
        item.style.display = 'none';
    });

   
    items[currentIndex].classList.add('active');
    items[currentIndex].style.display = 'block';

   
    if (currentIndex > 0) {
        items[currentIndex - 1].classList.add('left');
        items[currentIndex - 1].style.display = 'block';
    }
    
    if (currentIndex < items.length - 1) {
        items[currentIndex + 1].classList.add('right');
        items[currentIndex + 1].style.display = 'block';
    }
}

function moveSlider(direction) {
    currentIndex += direction;
    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex > items.length - 1) currentIndex = items.length - 1;
    updateSlider();
}

updateSlider();