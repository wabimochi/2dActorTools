/*! UIkit 3.5.8 | https://www.getuikit.com | (c) 2014 - 2020 YOOtheme | MIT License */

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('uikit-util')) :
    typeof define === 'function' && define.amd ? define('uikitsortable', ['uikit-util'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.UIkitSortable = factory(global.UIkit.util));
}(this, (function (uikitUtil) { 'use strict';

    var targetClass = 'uk-animation-target';

    var Animate = {

        props: {
            animation: Number
        },

        data: {
            animation: 150
        },

        methods: {

            animate: function(action, target) {
                var this$1 = this;
                if ( target === void 0 ) target = this.$el;


                addStyle();

                var children = uikitUtil.children(target);
                var propsFrom = children.map(function (el) { return getProps(el, true); });

                var oldHeight = uikitUtil.height(target);
                var oldScrollY = window.pageYOffset;

                action();

                uikitUtil.Transition.cancel(target);
                children.forEach(uikitUtil.Transition.cancel);

                reset(target);
                this.$update(target, 'resize');
                uikitUtil.fastdom.flush();

                var newHeight = uikitUtil.height(target);

                children = children.concat(uikitUtil.children(target).filter(function (el) { return !uikitUtil.includes(children, el); }));

                var propsTo = children.map(function (el, i) { return el.parentNode && i in propsFrom
                        ? propsFrom[i]
                        ? uikitUtil.isVisible(el)
                            ? getPositionWithMargin(el)
                            : {opacity: 0}
                        : {opacity: uikitUtil.isVisible(el) ? 1 : 0}
                        : false; }
                );

                propsFrom = propsTo.map(function (props, i) {
                    var from = children[i].parentNode === target
                        ? propsFrom[i] || getProps(children[i])
                        : false;

                    if (from) {
                        if (!props) {
                            delete from.opacity;
                        } else if (!('opacity' in props)) {
                            var opacity = from.opacity;

                            if (opacity % 1) {
                                props.opacity = 1;
                            } else {
                                delete from.opacity;
                            }
                        }
                    }

                    return from;
                });

                uikitUtil.addClass(target, targetClass);
                children.forEach(function (el, i) { return propsFrom[i] && uikitUtil.css(el, propsFrom[i]); });
                uikitUtil.css(target, {height: oldHeight, display: 'block'});
                uikitUtil.scrollTop(window, oldScrollY);

                return uikitUtil.Promise.all(
                    children.map(function (el, i) { return ['top', 'left', 'height', 'width'].some(function (prop) { return propsFrom[i][prop] !== propsTo[i][prop]; }
                        ) && uikitUtil.Transition.start(el, propsTo[i], this$1.animation, 'ease'); }
                    ).concat(oldHeight !== newHeight && uikitUtil.Transition.start(target, {height: newHeight}, this.animation, 'ease'))
                ).then(function () {
                    children.forEach(function (el, i) { return uikitUtil.css(el, {display: propsTo[i].opacity === 0 ? 'none' : '', zIndex: ''}); });
                    reset(target);
                    this$1.$update(target, 'resize');
                    uikitUtil.fastdom.flush(); // needed for IE11
                }, uikitUtil.noop);

            }
        }
    };

    function getProps(el, opacity) {

        var zIndex = uikitUtil.css(el, 'zIndex');

        return uikitUtil.isVisible(el)
            ? uikitUtil.assign({
                display: '',
                opacity: opacity ? uikitUtil.css(el, 'opacity') : '0',
                pointerEvents: 'none',
                position: 'absolute',
                zIndex: zIndex === 'auto' ? uikitUtil.index(el) : zIndex
            }, getPositionWithMargin(el))
            : false;
    }

    function reset(el) {
        uikitUtil.css(el.children, {
            height: '',
            left: '',
            opacity: '',
            pointerEvents: '',
            position: '',
            top: '',
            width: ''
        });
        uikitUtil.removeClass(el, targetClass);
        uikitUtil.css(el, {height: '', display: ''});
    }

    function getPositionWithMargin(el) {
        var ref = uikitUtil.offset(el);
        var height = ref.height;
        var width = ref.width;
        var ref$1 = uikitUtil.position(el);
        var top = ref$1.top;
        var left = ref$1.left;

        return {top: top, left: left, height: height, width: width};
    }

    var style;

    function addStyle() {
        if (style) {
            return;
        }
        style = uikitUtil.append(document.head, '<style>').sheet;
        style.insertRule(
            ("." + targetClass + " > * {\n            margin-top: 0 !important;\n            transform: none !important;\n        }"), 0
        );
    }

    var Class = {

        connected: function() {
            !uikitUtil.hasClass(this.$el, this.$name) && uikitUtil.addClass(this.$el, this.$name);
        }

    };

    var Component = {

        mixins: [Class, Animate],

        props: {
            group: String,
            threshold: Number,
            clsItem: String,
            clsPlaceholder: String,
            clsDrag: String,
            clsDragState: String,
            clsBase: String,
            clsNoDrag: String,
            clsEmpty: String,
            clsCustom: String,
            handle: String
        },

        data: {
            group: false,
            threshold: 5,
            clsItem: 'uk-sortable-item',
            clsPlaceholder: 'uk-sortable-placeholder',
            clsDrag: 'uk-sortable-drag',
            clsDragState: 'uk-drag',
            clsBase: 'uk-sortable',
            clsNoDrag: 'uk-sortable-nodrag',
            clsEmpty: 'uk-sortable-empty',
            clsCustom: '',
            handle: false,
            pos: {}
        },

        created: function() {
            var this$1 = this;

            ['init', 'start', 'move', 'end'].forEach(function (key) {
                var fn = this$1[key];
                this$1[key] = function (e) {
                    uikitUtil.assign(this$1.pos, uikitUtil.getEventPos(e));
                    fn(e);
                };
            });
        },

        events: {

            name: uikitUtil.pointerDown,
            passive: false,
            handler: 'init'

        },

        computed: {

            target: function() {
                return (this.$el.tBodies || [this.$el])[0];
            },

            items: function() {
                return uikitUtil.children(this.target);
            },

            isEmpty: {

                get: function() {
                    return uikitUtil.isEmpty(this.items);
                },

                watch: function(empty) {
                    uikitUtil.toggleClass(this.target, this.clsEmpty, empty);
                },

                immediate: true

            },

            handles: {

                get: function(ref, el) {
                    var handle = ref.handle;

                    return handle ? uikitUtil.$$(handle, el) : this.items;
                },

                watch: function(handles, prev) {
                    uikitUtil.css(prev, {touchAction: '', userSelect: ''});
                    uikitUtil.css(handles, {touchAction: uikitUtil.hasTouch ? 'none' : '', userSelect: 'none'}); // touchAction set to 'none' causes a performance drop in Chrome 80
                },

                immediate: true

            }

        },

        update: {

            write: function() {

                if (!this.drag || !uikitUtil.parent(this.placeholder)) {
                    return;
                }

                // clamp to viewport
                var ref = this.pos;
                var x = ref.x;
                var y = ref.y;
                var ref$1 = this.origin;
                var offsetTop = ref$1.offsetTop;
                var offsetLeft = ref$1.offsetLeft;
                var ref$2 = this.drag;
                var offsetHeight = ref$2.offsetHeight;
                var offsetWidth = ref$2.offsetWidth;
                var ref$3 = uikitUtil.offset(window);
                var right = ref$3.right;
                var bottom = ref$3.bottom;
                var target = document.elementFromPoint(x, y);

                uikitUtil.css(this.drag, {
                    top: uikitUtil.clamp(y - offsetTop, 0, bottom - offsetHeight),
                    left: uikitUtil.clamp(x - offsetLeft, 0, right - offsetWidth)
                });

                var sortable = this.getSortable(target);
                var previous = this.getSortable(this.placeholder);
                var move = sortable !== previous;

                if (!sortable || uikitUtil.within(target, this.placeholder) || move && (!sortable.group || sortable.group !== previous.group)) {
                    return;
                }

                target = sortable.target === target.parentNode && target || sortable.items.filter(function (element) { return uikitUtil.within(target, element); })[0];

                if (move) {
                    previous.remove(this.placeholder);
                } else if (!target) {
                    return;
                }

                sortable.insert(this.placeholder, target);

                if (!uikitUtil.includes(this.touched, sortable)) {
                    this.touched.push(sortable);
                }

            },

            events: ['move']

        },

        methods: {

            init: function(e) {

                var target = e.target;
                var button = e.button;
                var defaultPrevented = e.defaultPrevented;
                var ref = this.items.filter(function (el) { return uikitUtil.within(target, el); });
                var placeholder = ref[0];

                if (!placeholder
                    || defaultPrevented
                    || button > 0
                    || uikitUtil.isInput(target)
                    || uikitUtil.within(target, ("." + (this.clsNoDrag)))
                    || this.handle && !uikitUtil.within(target, this.handle)
                ) {
                    return;
                }

                e.preventDefault();

                this.touched = [this];
                this.placeholder = placeholder;
                this.origin = uikitUtil.assign({target: target, index: uikitUtil.index(placeholder)}, this.pos);

                uikitUtil.on(document, uikitUtil.pointerMove, this.move);
                uikitUtil.on(document, uikitUtil.pointerUp, this.end);

                if (!this.threshold) {
                    this.start(e);
                }

            },

            start: function(e) {

                this.drag = appendDrag(this.$container, this.placeholder);
                var ref = this.placeholder.getBoundingClientRect();
                var left = ref.left;
                var top = ref.top;
                uikitUtil.assign(this.origin, {offsetLeft: this.pos.x - left, offsetTop: this.pos.y - top});

                uikitUtil.addClass(this.drag, this.clsDrag, this.clsCustom);
                uikitUtil.addClass(this.placeholder, this.clsPlaceholder);
                uikitUtil.addClass(this.items, this.clsItem);
                uikitUtil.addClass(document.documentElement, this.clsDragState);

                uikitUtil.trigger(this.$el, 'start', [this, this.placeholder]);

                trackScroll(this.pos);

                this.move(e);
            },

            move: function(e) {

                if (this.drag) {
                    this.$emit('move');
                } else if (Math.abs(this.pos.x - this.origin.x) > this.threshold || Math.abs(this.pos.y - this.origin.y) > this.threshold) {
                    this.start(e);
                }

            },

            end: function(e) {

                uikitUtil.off(document, uikitUtil.pointerMove, this.move);
                uikitUtil.off(document, uikitUtil.pointerUp, this.end);
                uikitUtil.off(window, 'scroll', this.scroll);

                if (!this.drag) {
                    return;
                }

                untrackScroll();

                var sortable = this.getSortable(this.placeholder);

                if (this === sortable) {
                    if (this.origin.index !== uikitUtil.index(this.placeholder)) {
                        uikitUtil.trigger(this.$el, 'moved', [this, this.placeholder]);
                    }
                } else {
                    uikitUtil.trigger(sortable.$el, 'added', [sortable, this.placeholder]);
                    uikitUtil.trigger(this.$el, 'removed', [this, this.placeholder]);
                }

                uikitUtil.trigger(this.$el, 'stop', [this, this.placeholder]);

                uikitUtil.remove(this.drag);
                this.drag = null;

                var classes = this.touched.map(function (sortable) { return ((sortable.clsPlaceholder) + " " + (sortable.clsItem)); }).join(' ');
                this.touched.forEach(function (sortable) { return uikitUtil.removeClass(sortable.items, classes); });

                uikitUtil.removeClass(document.documentElement, this.clsDragState);

            },

            insert: function(element, target) {
                var this$1 = this;


                uikitUtil.addClass(this.items, this.clsItem);

                var insert = function () {

                    if (target) {

                        if (!uikitUtil.within(element, this$1.target) || isPredecessor(element, target)) {
                            uikitUtil.before(target, element);
                        } else {
                            uikitUtil.after(target, element);
                        }

                    } else {
                        uikitUtil.append(this$1.target, element);
                    }

                };

                if (this.animation) {
                    this.animate(insert);
                } else {
                    insert();
                }

            },

            remove: function(element) {

                if (!uikitUtil.within(element, this.target)) {
                    return;
                }

                if (this.animation) {
                    this.animate(function () { return uikitUtil.remove(element); });
                } else {
                    uikitUtil.remove(element);
                }

            },

            getSortable: function(element) {
                return element && (this.$getComponent(element, 'sortable') || this.getSortable(element.parentNode));
            }

        }

    };

    function isPredecessor(element, target) {
        return element.parentNode === target.parentNode && uikitUtil.index(element) > uikitUtil.index(target);
    }

    var trackTimer;
    function trackScroll(pos) {

        var last = Date.now();
        trackTimer = setInterval(function () {

            var x = pos.x;
            var y = pos.y;
            y += window.pageYOffset;

            var dist = (Date.now() - last) * .3;
            last = Date.now();

            uikitUtil.scrollParents(document.elementFromPoint(x, pos.y)).some(function (scrollEl) {

                var scroll = scrollEl.scrollTop;
                var scrollHeight = scrollEl.scrollHeight;

                var ref = uikitUtil.offset(uikitUtil.getViewport(scrollEl));
                var top = ref.top;
                var bottom = ref.bottom;
                var height = ref.height;

                if (top < y && top + 30 > y) {
                    scroll -= dist;
                } else if (bottom > y && bottom - 30 < y) {
                    scroll += dist;
                } else {
                    return;
                }

                if (scroll > 0 && scroll < scrollHeight - height) {
                    uikitUtil.scrollTop(scrollEl, scroll);
                    return true;
                }

            });

        }, 15);

    }

    function untrackScroll() {
        clearInterval(trackTimer);
    }

    function appendDrag(container, element) {
        var clone = uikitUtil.append(container, element.outerHTML.replace(/(^<)(?:li|tr)|(?:li|tr)(\/>$)/g, '$1div$2'));

        clone.style.setProperty('margin', '0', 'important');

        uikitUtil.css(clone, uikitUtil.assign({
            boxSizing: 'border-box',
            width: element.offsetWidth,
            height: element.offsetHeight,
            overflow: 'hidden'
        }, uikitUtil.css(element, ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'])));

        uikitUtil.height(clone.firstElementChild, uikitUtil.height(element.firstElementChild));

        return clone;
    }

    if (typeof window !== 'undefined' && window.UIkit) {
        window.UIkit.component('sortable', Component);
    }

    return Component;

})));
