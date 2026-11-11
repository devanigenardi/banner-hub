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

    gsap.set("#stage > div:not(#bg, .exit-trigger, .isi-container)", { autoAlpha: 0 });
    gsap.set('#f1-txt-1', { scale: 5, y: '50%' });
    gsap.set('#f1-txt-2, #f2-txt-1, #f3-txt-1', { x: '-100%' });
    gsap.set('#f3-logo', { scale: 8 });
    gsap.set('#f4-full-logo', { x: '-5%' });
    gsap.set('#cta', { scale: 5 });

    /* 🎞️ CREATE THE TIMELINE */
    tl = gsap.timeline();
        tl.addLabel("FRAME1_ENTER", 0)
		.addLabel("FRAME1_EXIT", "FRAME1_ENTER+=3")
		.addLabel("FRAME2_ENTER", "FRAME1_EXIT+=0.5")
		.addLabel("FRAME2_EXIT", "FRAME2_ENTER+=1")
		.addLabel("FRAME3_ENTER", "FRAME2_EXIT+=0.5")
		.addLabel("FRAME3_EXIT", "FRAME3_ENTER+=3")
		.addLabel("FRAME4_ENTER", "FRAME3_EXIT+=0.5")
        .addLabel("FRAME4_EXIT", "FRAME4_ENTER+=3")
		.addLabel("FRAME5_ENTER", "FRAME4_EXIT+=0.5")
        .addLabel("FRAME5_EXIT", "FRAME5_ENTER+=3")
		.addLabel("FRAME6_ENTER", "FRAME5_EXIT+=0.5")
        .addLabel("FRAME6_EXIT", "FRAME6_ENTER+=3")

        /* 🎬 PLAY ANIMATION */

        // FRAME 1
        .to('#f1-txt-1', { duration: 0.5, scale: 1, y: 0, autoAlpha: 1, ease: 'power2.inOut' }, "FRAME1_ENTER")
        .to('#f1-txt-2', { duration: 0.5, x: '0', autoAlpha: 1, ease: 'power3.out' }, "FRAME1_ENTER+=0.25")
        .to('#f1-txt-2,#f1-txt-1', { duration: 0.5, x: '100%', autoAlpha: 1, ease: 'power3.in' }, "FRAME1_EXIT")

        // FRAME 2
        .to('#f2-txt-1', { duration: 0.5, x: '0', autoAlpha: 1, ease: 'power3.out' }, "FRAME2_ENTER")
        .to('#f2-txt-1', { duration: 0.5, x: '100%', autoAlpha: 1, ease: 'power3.in' }, "FRAME2_EXIT")

        // FRAME 3
        .to('#f3-txt-1', { duration: 0.5, x: '0', autoAlpha: 1, ease: 'power3.out' }, "FRAME3_ENTER")
        .to('#f3-txt-1', { duration: 0.5, x: '100%', autoAlpha: 1, ease: 'power3.in' }, "FRAME3_EXIT")
        
        // FRAME 4
        .to('#f3-logo', { duration: 0.3, scale: 1, autoAlpha: 1, ease: 'power3.out' }, "FRAME4_ENTER")

        // FRAME 5
        .to('#f3-logo', { duration: 0.5, x: -102, y: -60, scale: 0.4, ease: 'power3.inOut' }, "FRAME5_ENTER")
        .to('#f4-full-logo', { duration: 0.5, autoAlpha: 1, x: 0, ease: 'power4.out' }, "FRAME5_ENTER+=0.3")
        .to('#cta', { duration: 0.5, scale: 1, autoAlpha: 1, ease: 'power3.out' }, "FRAME5_ENTER+=0.3")

        .call(mainISI.delayedAutoScroll);

    console.log(`%c>>>>>>> ⏱️ Animation duration: ${tl.totalDuration()}`, 'color: lightblue; font-weight: bold;');
}