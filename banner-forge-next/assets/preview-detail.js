(function() {
    var d = __detailData;
    var testResults = d.testResults;
    var testTimestamp = d.testTimestamp;

    var fsColor = d.filesizeBytes ? ((d.filesizeBytes / 1024) > d.maxFilesize ? '#ff4444' : '#22c55e') : 'gray';
    var durColor = 'gray'; // Will be updated by postMessage

    var html = '';

    // Campaign
    html += '<h3>Campaign</h3>';
    html += '<div class="stat"><span class="stat-label">Client</span><span style="color:white;">' + d.client + '</span></div>';
    html += '<div class="stat"><span class="stat-label">Brand</span><span style="color:white;">' + d.brand + '</span></div>';
    html += '<div class="stat"><span class="stat-label">Campaign</span><span style="color:white;">' + d.campaign + '</span></div>';
    html += '<div class="stat"><span class="stat-label">Concept</span><span style="color:white;">' + d.concept + '</span></div>';

    // Banner Specs
    html += '<h3>Banner Specs</h3>';
    html += '<div class="stat"><span class="stat-label">Size</span><span style="color:white;">' + d.size + '</span></div>';
    html += '<div class="stat"><span class="stat-label">Format</span><span class="badge" id="detail-format">—</span></div>';
    html += '<div class="stat"><span class="stat-label">Animation</span><span class="badge" id="detail-engine">—</span></div>';
    html += '<div class="stat"><span class="stat-label">Filesize</span><span><span style="color:' + fsColor + ';">' + d.filesize + '</span> <span style="color:#666;">(' + d.maxFilesize + ' KB max)</span></span></div>';
    html += '<div class="stat"><span class="stat-label">Duration</span><span id="detail-duration"><span style="color:gray;">—</span> <span style="color:#666;">(' + d.maxDuration + 's max)</span></span></div>';

    // Optimization
    html += '<h3>Optimization</h3>';
    var opt = d.optimization;
    if (opt.count === 0) {
        html += '<div style="color:#ff4444;font-size:12px;margin-bottom:8px;">Not optimized — run <code style="background:#444;padding:1px 6px;border-radius:3px;">npm run optimize</code></div>';
    } else {
        var overallColor = opt.overallReduction > 20 ? '#22c55e' : (opt.overallReduction > 0 ? '#f59e0b' : '#ff4444');
        html += '<div class="stat"><span class="stat-label">Overall reduction</span><span style="color:' + overallColor + ';font-weight:bold;">' + opt.overallReduction + '%</span></div>';
        html += '<div class="stat"><span class="stat-label">Images</span><span>' + opt.count + ' optimized</span></div>';

        html += '<div style="margin-top:10px;">';
        var visibleCount = 4;
        opt.assets.forEach(function(a, i) {
            var redColor = a.reduction > 20 ? '#22c55e' : (a.reduction > 0 ? '#f59e0b' : '#999');
            var beforeKB = (a.sizeBefore / 1024).toFixed(1);
            var afterKB = (a.sizeAfter / 1024).toFixed(1);
            var isHidden = i >= visibleCount;
            html += '<div data-opt-item="1" style="background:#333;border-radius:4px;padding:8px 10px;margin-bottom:4px;justify-content:space-between;align-items:center;display:' + (isHidden ? 'none' : 'flex') + ';">' +
                '<span style="color:white;font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + a.name + '">' + a.name + '</span>' +
                '<span style="color:#999;font-size:11px;margin:0 8px;white-space:nowrap;">' + beforeKB + ' → ' + afterKB + ' KB</span>' +
                '<span style="color:' + redColor + ';font-size:11px;font-weight:bold;white-space:nowrap;">-' + a.reduction + '%</span>' +
                '</div>';
        });
        if (opt.assets.length > visibleCount) {
            var remaining = opt.assets.length - visibleCount;
            html += '<div id="opt-expand" onclick="document.querySelectorAll(\'[data-opt-item]\').forEach(function(el){el.style.display=\'flex\';});this.style.display=\'none\';document.getElementById(\'opt-collapse\').style.display=\'block\';" ' +
                'style="cursor:pointer;padding:8px 0;color:#999;font-size:11px;text-align:center;user-select:none;">' +
                '+ ' + remaining + ' more asset' + (remaining > 1 ? 's' : '') + '</div>';
            html += '<div id="opt-collapse" onclick="var items=document.querySelectorAll(\'[data-opt-item]\');items.forEach(function(el,i){el.style.display=i>=' + visibleCount + '?\'none\':\'flex\';});this.style.display=\'none\';document.getElementById(\'opt-expand\').style.display=\'block\';" ' +
                'style="display:none;cursor:pointer;padding:8px 0;color:#999;font-size:11px;text-align:center;user-select:none;">' +
                'Show less</div>';
        }
        html += '</div>';
    }

    // ClickTags
    html += '<h3>ClickTags <span id="detail-ct-count">(—)</span></h3>';
    if (testTimestamp) {
        html += '<div style="font-size:11px;color:#666;margin-bottom:10px;">Last tested: ' + new Date(testTimestamp).toLocaleString() + '</div>';
    } else {
        html += '<div style="font-size:11px;color:#ff4444;margin-bottom:10px;">Not tested yet — run <code style="background:#444;padding:1px 6px;border-radius:3px;">npm run test</code></div>';
    }
    html += '<div id="detail-clicktags"><span style="color:#666;">Detecting...</span></div>';

    document.getElementById('panel-content').innerHTML = html;

    // Listen for postMessage from the banner iframe
    window.addEventListener('message', function(event) {
        try {
            var data = event.data;
            if (!data) return;

            if (data.type === 'bannerAnimationDuration' && data.duration != null) {
                var durSpan = document.getElementById('detail-duration');
                if (durSpan) {
                    var color = data.duration > d.maxDuration ? '#ff4444' : '#22c55e';
                    durSpan.innerHTML = '<span style="color:' + color + ';">' + data.duration.toFixed(1) + 's</span> <span style="color:#666;">(' + d.maxDuration + 's max)</span>';
                }
            }

            if (data.type === 'bannerClickTags') {
                var formatEl = document.getElementById('detail-format');
                var engineEl = document.getElementById('detail-engine');
                var ctCountEl = document.getElementById('detail-ct-count');
                var ctContainer = document.getElementById('detail-clicktags');

                if (formatEl) formatEl.textContent = data.format || 'STD';
                if (engineEl) engineEl.textContent = data.animationEngine || 'Unknown';

                var clickTags = data.clickTags || [];
                if (ctCountEl) ctCountEl.textContent = '(' + clickTags.length + ')';

                if (clickTags.length === 0) {
                    ctContainer.innerHTML = '<span style="color:#666;">No clickTags detected</span>';
                    return;
                }

                var cardsHtml = '';
                clickTags.forEach(function(ct) {
                    var hasValue = ct.value && ct.value !== 'undefined' && ct.value !== '';
                    var statusColor = hasValue ? '#22c55e' : '#ff4444';
                    var statusDot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + statusColor + ';margin-right:6px;"></span>';
                    var statusText = hasValue ? ct.value : 'undefined';
                    var elementInfo = ct.elements.length > 0 ? ct.elements.map(function(el) {
                        return '<span style="background:#444;padding:2px 8px;border-radius:3px;font-size:11px;display:inline-block;margin:2px 4px 2px 0;">' + el + '</span>';
                    }).join('') : '<span style="color:#555;font-size:11px;">No element found</span>';

                    var testBadge = '';
                    if (testResults && testResults.tests) {
                        var matchingTest = testResults.tests.find(function(t) { return t.exitName === ct.name; });
                        if (matchingTest) {
                            var isPassed = matchingTest.status === 'pass';
                            testBadge = '<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:bold;margin-left:8px;' +
                                'background:' + (isPassed ? 'rgba(34,197,94,0.15);color:#22c55e' : 'rgba(255,68,68,0.15);color:#ff4444') + ';">' +
                                (isPassed ? 'TESTED ✓' : 'TEST FAILED') + '</span>';
                        }
                    } else {
                        testBadge = '<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:bold;margin-left:8px;background:rgba(255,255,255,0.05);color:#666;">NOT TESTED</span>';
                    }

                    cardsHtml += '<div style="background:#333;border-radius:6px;padding:12px;margin-bottom:8px;">' +
                        '<div style="display:flex;align-items:center;margin-bottom:6px;">' + statusDot + '<span style="color:white;font-weight:bold;font-size:13px;">' + ct.name + '</span>' + testBadge + '</div>' +
                        '<div style="color:' + statusColor + ';font-size:12px;word-break:break-all;margin-bottom:8px;">' + statusText + '</div>' +
                        '<div style="font-size:11px;color:#999;">Element: ' + elementInfo + '</div>' +
                        '</div>';
                });

                ctContainer.innerHTML = cardsHtml;
            }
        } catch(e) {}
    });

    // Inject detection script into the banner iframe after it loads
    var iframe = document.querySelector('.banner-area iframe');
    if (iframe) {
        iframe.addEventListener('load', function() {
            setTimeout(function() {
                try {
                    var detectCode = '(function(){try{var size="' + d.size + '";var duration=null;try{if(typeof gsap!=="undefined"&&gsap.globalTimeline){var children=gsap.globalTimeline.getChildren(true,true,true);var maxDur=0;for(var i=0;i<children.length;i++){try{var dd=children[i].totalDuration?children[i].totalDuration():0;if(dd>maxDur)maxDur=dd;}catch(e){}}try{var globalDur=gsap.globalTimeline.totalDuration();if(globalDur>maxDur)maxDur=globalDur;}catch(e){}if(maxDur>0)duration=maxDur;}}catch(e){}if(duration===null){try{if(typeof lib!=="undefined"&&lib.properties){var fps=lib.properties.fps||24;var root=typeof exportRoot!=="undefined"?exportRoot:(typeof stage!=="undefined"&&stage.children&&stage.children[0])||null;if(root&&root.totalFrames)duration=root.totalFrames/fps;}}catch(e){}}if(duration!==null&&duration>0){window.parent.postMessage({type:"bannerAnimationDuration",size:size,duration:duration},"*");}var format="STD";var animationEngine="Unknown";var clickTags=[];try{if(typeof Enabler!=="undefined"||typeof studio!=="undefined")format="RMDC";}catch(e){}try{var gwdMeta=document.querySelector("meta[name=generator][content*=\\"Google Web Designer\\"]");var gwdScripts=document.querySelectorAll("script[src*=gwd]");var hasGwd=gwdMeta||gwdScripts.length>0||typeof window.gwd!=="undefined";if(!hasGwd){var allEls=document.querySelectorAll("[class*=gwd-]");if(allEls.length>0)hasGwd=true;}if(hasGwd)animationEngine="GWD";else if(typeof lib!=="undefined"&&lib.properties)animationEngine="Animate CC";else if(typeof gsap!=="undefined")animationEngine="GSAP";}catch(e){}var exitElements=document.querySelectorAll("[data-exit]");var exitMap={};exitElements.forEach(function(el){var exitName=el.getAttribute("data-exit");if(!exitMap[exitName])exitMap[exitName]=[];var id=el.id?"#"+el.id:"";var cls=el.className?"."+String(el.className).split(" ").join("."):"";var tag=el.tagName.toLowerCase();exitMap[exitName].push(tag+id+cls);});var clickTagPattern=/^clickTag\\d*$/;for(var key in window){try{if(clickTagPattern.test(key)){var val=window[key];clickTags.push({name:key,value:(val!==undefined&&val!==null)?String(val):"undefined",elements:exitMap[key]||[]});}}catch(e){}}["clickTag","clickTag1","clickTag2","clickTag3","clickTag4","clickTag5"].forEach(function(name){var alreadyFound=clickTags.some(function(ct){return ct.name===name;});if(!alreadyFound){try{var val=eval("typeof "+name+"!==\\"undefined\\"?"+name+":undefined");if(val!==undefined)clickTags.push({name:name,value:String(val),elements:exitMap[name]||[]});}catch(e){}}});if(format==="RMDC"){try{var scripts=document.querySelectorAll("script");scripts.forEach(function(s){var text=s.textContent||"";var exitMatches=text.match(/Enabler\\.exit\\s*\\(\\s*[\\x27"](.*?)[\\x27"]/g);if(exitMatches){exitMatches.forEach(function(m){var nameMatch=m.match(/Enabler\\.exit\\s*\\(\\s*[\\x27"](.+?)[\\x27"]/);if(nameMatch){var eName=nameMatch[1];var af=clickTags.some(function(ct){return ct.name===eName;});if(!af)clickTags.push({name:eName,value:"Enabler.exit()",elements:exitMap[eName]||["Enabler managed"]});}});}});}catch(e){}}for(var exitName in exitMap){var af=clickTags.some(function(ct){return ct.name===exitName;});if(!af){var val="undefined";try{val=eval("typeof "+exitName+"!==\\"undefined\\"?"+exitName+":\\"undefined\\"");}catch(e){}clickTags.push({name:exitName,value:String(val),elements:exitMap[exitName]});}}clickTags.sort(function(a,b){return a.name.localeCompare(b.name);});window.parent.postMessage({type:"bannerClickTags",size:size,format:format,animationEngine:animationEngine,clickTags:clickTags},"*");}catch(e){}})();';
                    var script = iframe.contentDocument.createElement('script');
                    script.textContent = detectCode;
                    iframe.contentDocument.body.appendChild(script);
                } catch(e) {}
            }, 1500);
        });
    }
})();
