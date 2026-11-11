Zepto(function($){

    const checkboxes = $('.sizes-controls input[type="checkbox"]');

    // Refresh functionality
    $('button.refresh').on('click', (e)=>{
        $(e.currentTarget).closest('.banner-slot').find('iframe')[0].contentWindow.location.reload();
    })

    // Open banner detail view in new tab
    $('button.open-tab').on('click', (e)=>{
        const slot = $(e.currentTarget).closest('.banner-slot');
        const size = slot.data('size');
        if (!size) return;
        window.open('./detail/' + size + '.html', '_blank');
    })

    // On size checkbox clicked
    checkboxes.on('change', (e)=>{
        console.log('change in ' + e.currentTarget)
        toggleBannerSlot(e.currentTarget);
        updateURLParams();
    })
    
    //adChoices
    $('#adchoices-check').on('change', (e)=>{
        if(e.currentTarget.checked){
            $('.adchoices-controls').css('display', 'block')
            applyAdChoicesLogo();
        }else{
            $('.adchoices-controls').css('display', null)
            removeAdChoiceLogo();
        }
    })

    $('.adchoices-controls input').on('change', (e)=>{
        updateAdChoiceLogoStyling();
    })

    // Download
    $('button.download-btn').on('click', (e)=>{
        gsap.set('.modal', {display:'flex', opacity:0})
        gsap.to('.modal', {duration:0.3, opacity:1})
        gsap.from('.modal .modal-box', {duration:0.3, scale:0.9, opacity:0})
    })
    $('button.close-trigger, .modal').on('click', (e)=>{
        console.log( $(e.target).hasClass('close-trigger') )
        if($(e.target).hasClass('close-trigger')){
            gsap.to('.modal', {duration:0.3, opacity:0, onComplete:()=>{
                gsap.set('.modal', {display:'none'})
            }})
        }
    })
    $('.download-all').on('click', (e)=>{
        var path = window.location.pathname; // Gets the current path
        var form = document.createElement('form');
        form.action = 'https://bannerforge.assemblestudio.com/server-scripts/zipall.php';
        form.method = 'POST';
    
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'path';
        input.value = path;
        form.appendChild(input);
    
        document.body.appendChild(form);
        form.submit();
    })

    //Methods

    const toggleBannerSlot = (item)=>{
        const idx = item.id.split('_')[1];
        const bannerslot = $(`#frame_${idx}`).parent().parent();
        bannerslot.css('display', item.checked ? null : 'none')
    }

    const updateURLParams = () =>{
        let selectedSizes = [];
    
        checkboxes.each( (idx, item) => {
            $(item).prop('checked') ? selectedSizes.push($(item).val()) : null;
        });

        const sizesQueryString = selectedSizes.length > 0 ? 'sizes=' + selectedSizes.join(',') : '';
        const newURL = window.location.protocol + '//' + window.location.host + window.location.pathname + '?' + sizesQueryString;
        history.pushState(null, null, newURL);
    }

    const readURLParams = () =>{
        const urlParams = new URLSearchParams(window.location.search);
        const sizesParam = urlParams.get('sizes');
        const selectedSizes = sizesParam ? sizesParam.split(',') : [];

        if(selectedSizes.length > 0){
            checkboxes.each( (idx, item) => {
                $(item).prop('checked', selectedSizes.includes($(item).val()));
                toggleBannerSlot(item);
            });
        }
    }
    
    const applyAdChoicesLogo = ()=>{
        const color = document.querySelector('#bgcolor').value;
        const xpos = document.querySelector('input[name="x-position"]:checked').value;
        const ypos = document.querySelector('input[name="y-position"]:checked').value;

        document.querySelectorAll('.iframe-wrapper').forEach((item, index)=>{
            item.classList.add('adchoices', xpos, ypos)
            document.documentElement.style.setProperty('--adchoice-color', color);
        })
    }

    const removeAdChoiceLogo = ()=> {
        document.querySelectorAll('.iframe-wrapper').forEach((item, index)=>{
            item.classList.remove('adchoices', 'top', 'bottom', 'left', 'right');
            item.style.backgroundColor = null;
        })
    }
    
    const updateAdChoiceLogoStyling = ()=> {
        removeAdChoiceLogo();
        applyAdChoicesLogo();
    }

    readURLParams();

    /************* Animation Duration Detection **************/

    // Store banner data globally for detail view
    window.__bannerData = {};

    // Listen for postMessage from iframes
    window.addEventListener('message', (event) => {
        try {
            const data = event.data;
            if (!data || !data.size) return;

            if (data.type === 'bannerAnimationDuration') {
                const slots = document.querySelectorAll('.banner-slot');
                slots.forEach((slot) => {
                    if (slot.dataset.size === data.size) {
                        const durationValue = slot.querySelector('.duration-value');
                        if (durationValue && data.duration != null) {
                            durationValue.textContent = data.duration.toFixed(1) + 's';
                            var maxDur = parseFloat(slot.dataset.maxDuration) || 15;
                            if (data.duration > maxDur) {
                                durationValue.classList.add('over-limit');
                            } else {
                                durationValue.classList.add('under-limit');
                            }
                        }
                    }
                });
            }

            if (data.type === 'bannerClickTags') {
                if (!window.__bannerData[data.size]) window.__bannerData[data.size] = {};
                window.__bannerData[data.size].clickTags = data.clickTags;
                window.__bannerData[data.size].format = data.format;
                window.__bannerData[data.size].animationEngine = data.animationEngine;

                const slots = document.querySelectorAll('.banner-slot');
                slots.forEach((slot) => {
                    if (slot.dataset.size === data.size) {
                        const ctValue = slot.querySelector('.clicktag-value');
                        if (ctValue) {
                            var count = data.clickTags.length;
                            var allSet = data.clickTags.every(function(ct) {
                                return ct.value && ct.value !== 'undefined' && ct.value !== '';
                            });
                            ctValue.textContent = count;
                            if (count > 0) {
                                ctValue.classList.add(allSet ? 'under-limit' : 'over-limit');
                            }
                        }
                    }
                });
            }
        } catch (e) {
            // Ignore malformed messages
        }
    });

    // Inject detection script into each banner iframe after it loads
    const detectionScript = `
        (function() {
            try {
                var size = '%%SIZE%%';

                /*** Animation Duration Detection ***/
                var duration = null;
                try {
                    if (typeof gsap !== 'undefined' && gsap.globalTimeline) {
                        var children = gsap.globalTimeline.getChildren(true, true, true);
                        var maxDur = 0;
                        for (var i = 0; i < children.length; i++) {
                            try {
                                var d = children[i].totalDuration ? children[i].totalDuration() : 0;
                                if (d > maxDur) maxDur = d;
                            } catch(e) {}
                        }
                        try {
                            var globalDur = gsap.globalTimeline.totalDuration();
                            if (globalDur > maxDur) maxDur = globalDur;
                        } catch(e) {}
                        if (maxDur > 0) duration = maxDur;
                    }
                } catch(e) {}
                if (duration === null) {
                    try {
                        if (typeof lib !== 'undefined' && lib.properties) {
                            var fps = lib.properties.fps || 24;
                            var root = typeof exportRoot !== 'undefined' ? exportRoot :
                                       (typeof stage !== 'undefined' && stage.children && stage.children[0]) || null;
                            if (root && root.totalFrames) duration = root.totalFrames / fps;
                        }
                    } catch(e) {}
                }
                if (duration !== null && duration > 0) {
                    window.parent.postMessage({ type: 'bannerAnimationDuration', size: size, duration: duration }, '*');
                }

                /*** Format, Animation Engine + ClickTag Detection ***/
                var format = 'STD';
                var animationEngine = 'Unknown';
                var clickTags = [];

                // Detect ad format: STD or RMDC
                try {
                    if (typeof Enabler !== 'undefined' || typeof studio !== 'undefined') {
                        format = 'RMDC';
                    }
                } catch(e) {}

                // Detect animation engine
                try {
                    // GWD: meta generator tag, gwd* scripts, or window.gwd
                    var gwdMeta = document.querySelector('meta[name="generator"][content*="Google Web Designer"]');
                    var gwdScripts = document.querySelectorAll('script[src*="gwd"]');
                    var hasGwd = gwdMeta || gwdScripts.length > 0 || typeof window.gwd !== 'undefined';
                    // Also check for gwd- CSS classes
                    if (!hasGwd) {
                        var allEls = document.querySelectorAll('[class*="gwd-"]');
                        if (allEls.length > 0) hasGwd = true;
                    }

                    if (hasGwd) {
                        animationEngine = 'GWD';
                    } else if (typeof lib !== 'undefined' && lib.properties) {
                        animationEngine = 'Animate CC';
                    } else if (typeof gsap !== 'undefined') {
                        animationEngine = 'GSAP';
                    }
                } catch(e) {}

                // Find all elements with data-exit attributes
                var exitElements = document.querySelectorAll('[data-exit]');
                var exitMap = {};
                exitElements.forEach(function(el) {
                    var exitName = el.getAttribute('data-exit');
                    if (!exitMap[exitName]) exitMap[exitName] = [];
                    var id = el.id ? '#' + el.id : '';
                    var cls = el.className ? '.' + String(el.className).split(' ').join('.') : '';
                    var tag = el.tagName.toLowerCase();
                    exitMap[exitName].push(tag + id + cls);
                });

                // Detect clickTag variables: check window properties
                var clickTagPattern = /^clickTag\\d*$/;
                for (var key in window) {
                    try {
                        if (clickTagPattern.test(key)) {
                            var val = window[key];
                            clickTags.push({
                                name: key,
                                value: (val !== undefined && val !== null) ? String(val) : 'undefined',
                                elements: exitMap[key] || []
                            });
                        }
                    } catch(e) {}
                }

                // Also try common names not on window (let/const)
                var commonNames = ['clickTag', 'clickTag1', 'clickTag2', 'clickTag3', 'clickTag4', 'clickTag5'];
                commonNames.forEach(function(name) {
                    var alreadyFound = clickTags.some(function(ct) { return ct.name === name; });
                    if (!alreadyFound) {
                        try {
                            var val = eval('typeof ' + name + ' !== "undefined" ? ' + name + ' : undefined');
                            if (val !== undefined) {
                                clickTags.push({
                                    name: name,
                                    value: String(val),
                                    elements: exitMap[name] || []
                                });
                            }
                        } catch(e) {}
                    }
                });

                // For RMDC, detect Enabler.exit() calls from source
                if (format === 'RMDC') {
                    try {
                        var scripts = document.querySelectorAll('script');
                        scripts.forEach(function(s) {
                            var text = s.textContent || '';
                            var exitMatches = text.match(/Enabler\\.exit\\s*\\(\\s*['"](.*?)['"]/g);
                            if (exitMatches) {
                                exitMatches.forEach(function(m) {
                                    var nameMatch = m.match(/Enabler\\.exit\\s*\\(\\s*['"](.+?)['"]/);
                                    if (nameMatch) {
                                        var eName = nameMatch[1];
                                        var alreadyFound = clickTags.some(function(ct) { return ct.name === eName; });
                                        if (!alreadyFound) {
                                            clickTags.push({
                                                name: eName,
                                                value: 'Enabler.exit()',
                                                elements: exitMap[eName] || ['Enabler managed']
                                            });
                                        }
                                    }
                                });
                            }
                        });
                    } catch(e) {}
                }

                // Check data-exit elements not yet matched to a variable
                for (var exitName in exitMap) {
                    var alreadyFound = clickTags.some(function(ct) { return ct.name === exitName; });
                    if (!alreadyFound) {
                        var val = 'undefined';
                        try { val = eval('typeof ' + exitName + ' !== "undefined" ? ' + exitName + ' : "undefined"'); } catch(e) {}
                        clickTags.push({
                            name: exitName,
                            value: String(val),
                            elements: exitMap[exitName]
                        });
                    }
                }

                clickTags.sort(function(a, b) { return a.name.localeCompare(b.name); });

                window.parent.postMessage({
                    type: 'bannerClickTags',
                    size: size,
                    format: format,
                    animationEngine: animationEngine,
                    clickTags: clickTags
                }, '*');

            } catch(e) {}
        })();
    `;

    document.querySelectorAll('.banner-slot iframe').forEach((iframe) => {
        iframe.addEventListener('load', () => {
            const size = iframe.dataset.size;
            if (!size) return;
            // Wait for banner scripts to initialize before detecting
            setTimeout(() => {
                try {
                    const script = iframe.contentDocument.createElement('script');
                    script.textContent = detectionScript.replace('%%SIZE%%', size);
                    iframe.contentDocument.body.appendChild(script);
                } catch(e) {
                    // Cross-origin or security error — silently skip
                }
            }, 1500);
        });
    });

})
