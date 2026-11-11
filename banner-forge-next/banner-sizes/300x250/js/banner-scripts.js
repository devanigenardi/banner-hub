let tl;
let mainISI;
let imagesArray = ["bg.jpg","cta.png","f1-txt-1.png","f1-txt-2.png","f2-txt-1.png","f3-logo.png","f3-txt-1.png","f4-full-logo.png"];
let delay;

document.addEventListener('DOMContentLoaded', (e) => {
    window.onload = ()=> bitmapPreload();
});

const bitmapPreload = ()=>{
    console.log('%c>>>>>>> 🖼️ Preloading images:', 'color: lightblue; font-weight: bold;');
    let counter = 0;
    imagesArray.forEach((item, index)=>{
        const temp = new Image();
        temp.src = "images/" + item;
        temp.addEventListener("load", ()=> {
            console.log('○ Image loaded: ' + item);
            counter++;
            (counter == imagesArray.length) ? checkInitLoadScripts() : null;
        });
        temp.addEventListener("error", ()=> {
            console.error('Image not found: ' + temp.src + '\nPlease check the file name and path is correct.');
        });
    })
}

const checkInitLoadScripts = ()=> {
    window.ScrollToPlugin && window.OverlayScrollbars
        ? init()
        : setTimeout(checkInitLoadScripts, 10);
}

const init = ()=> {
    fileLoader(['./css/styles.css','./css/isi.css']);
}

const fileLoader = (list) => {
    console.log('%c>>>>>>> 📄 Loading Scripts & Stylesheets:', 'color: lightblue; font-weight: bold;');
    list.forEach((path, idx)=>{
        const extension = path.split('.').pop()
    
        let file;
        if (extension === 'js') {
            file = document.createElement('script');
            file.setAttribute('type', 'text/javascript');
            file.setAttribute('src', path);
        } else if (extension === 'css') {
            file = document.createElement('link');
            file.setAttribute('rel', 'stylesheet');
            file.setAttribute('href', path);
        }

        document.querySelector('head').appendChild(file);
        console.log('○ File loaded: ' + path);

        (idx === list.length - 1) ? clickTagLoader() : null;
    })
}

const clickTagLoader = () => {
    console.log('%c>>>>>>> 🏷️ Setting-up Clicktags:', 'color: lightblue; font-weight: bold;');
    const exitTriggers = document.querySelectorAll('[data-exit]');

    const clickTagHandler = (e)=> {
        e.preventDefault();
        let clickTag = e.target.getAttribute('data-exit');
        window.open(window[clickTag]);
    }
    exitTriggers.forEach( (item, idx) => {
        item.addEventListener('click', clickTagHandler);
        console.log('○ Clicktag set: ' + item.getAttribute('data-exit') + ` | ${window[item.getAttribute('data-exit')]}` + ' on ', item);
        
        (idx === exitTriggers.length - 1) ? startAnimation() : null;
    })
}

const ISI = (selector, autoScrollSpeed, autoScrollDelay) => {
    console.log('%c>>>>>>> 📜 Setting-up ISI', 'color: lightblue; font-weight: bold;');
    let isi = {};
    isi.bannerWrapper = document.querySelector('#banner-wrapper');
    isi.isiContainer = document.querySelector(selector);

    isi.scrollObject = OverlayScrollbars(
        isi.isiContainer.querySelector('.isi-copy-wrapper .isi-copy'), {
            className: 'custom-isi',
            sizeAutoCapable: false,
            overflowBehavior: { x: 'hidden', y: 'scroll'},
            callbacks: {
                onScrollStart: null,
                onScroll: null,
                onScrollStop: null,
            },
        }
    );

    isi.autoScrollTimeline = gsap.timeline();
    isi.scrollAuxiliaryTimeline = gsap.timeline();

    isi.autoScrollDistance = isi.isiContainer.querySelector(
        selector + ' .isi-copy-inner-wrapper'
    ).offsetHeight;

    isi.autoScrollSpeed = autoScrollSpeed;
    isi.autoScrollDuration = isi.autoScrollDistance / isi.autoScrollSpeed;
    isi.autoScrollDelay = autoScrollDelay;

    isi.autoScroll = function () {
        isi.scrollObject.scroll({ y: '0%' }, 0, { y: 'linear' });

        isi.autoScrollTimeline.to(
            selector + ' .os-viewport',
            isi.autoScrollDuration,
            {
                scrollTo: {y: isi.autoScrollDistance, autoKill: true},
                ease: Power0.easeNone,
            }
        );
    };

    isi.delayedAutoScroll = function () {
        let delay = (isi.autoScrollDelay >= 0) ? isi.autoScrollDelay * 1000 : 0;
        console.log(delay)
        setTimeout(isi.autoScroll, delay)
    };

    isi.autoScrollDelay === 0 ? isi.delayedAutoScroll() : null;

    isi.scrollStop = function () {
        isi.scrollAuxiliaryTimeline.kill();
    };

    return isi;
}

const startAnimation = ()=> {
    mainISI = ISI('.isi-container', 6.666666666666667, -1);

    console.log('%c>>>>>>> 🏁 Starting animation:', 'color: lightblue; font-weight: bold;');
    
    gsap.set('#preloader', { display: 'none' });
    gsap.set('#stage', { visibility: 'visible' });

    gsap.set("#stage > div:not(#bg, .exit-trigger, .isi-container)", {autoAlpha: 0});
    gsap.set('#f1-txt-1', {scale:5, y:'50%'})
    gsap.set('#f1-txt-2, #f2-txt-1, #f3-txt-1', {x:'-100%'})
    gsap.set('#f3-logo', {scale:8})
    gsap.set('#f4-full-logo', {x:'-5%'})
    gsap.set('#cta', {scale:5})
    
    tl = new gsap.timeline();

    tl.to('#f1-txt-1', {duration:0.5, scale:1, y:0, autoAlpha:1, ease:'power2.inOut'})
        .to('#f1-txt-2', {duration:0.5, x:'0', autoAlpha:1, ease:'power3.out'}, '+=0.25')
        .to('#f1-txt-2', {duration:0.5, x:'100%', autoAlpha:1, ease:'power3.in'}, '+=1')
    
        .to('#f2-txt-1', {duration:0.5, x:'0', autoAlpha:1, ease:'power3.out'}, '+=0.0')
        .to('#f2-txt-1', {duration:0.5, x:'100%', autoAlpha:1, ease:'power3.in'}, '+=1.0')
   
        .to('#f3-txt-1', {duration:0.5, x:'0', autoAlpha:1, ease:'power3.out'}, '+=0.0')
        .to('#f3-txt-1', {duration:0.5, x:'100%', autoAlpha:1, ease:'power3.in'}, '+=1.0')
        .to('#f3-logo', {duration:0.3, scale:1, autoAlpha:1, ease:'power3.out'}, '+=0.0')

        .to('#f1-txt-1', {duration:0.25, autoAlpha:0, ease:'power2.out'}, '+=1.0')
        .to('#f3-logo', {duration:0.5, x:-102, y:-60, scale:0.4, ease:'power3.inOut'}, '+=0.0')
        .to('#f4-full-logo', {duration:0.5, autoAlpha:1, x:0, ease:'power4.out'}, '-=0.2s')
        .to('#cta', {duration:0.5, scale:1, autoAlpha:1, ease:'power3.out'}, '-=0.0')

        .call(mainISI.delayedAutoScroll);

    console.log(`%c>>>>>>> ⏱️ Animation duration: ${tl.totalDuration()}`, 'color: lightblue; font-weight: bold;');
}