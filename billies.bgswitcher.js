/*!
 * jQuery.BgSwitcher
 *
 * @version  0.4.3
 * @author   rewish <rewish.org@gmail.com>
 * @license  MIT License (https://github.com/rewish/jquery-bgswitcher/blob/master/LICENSE.md)
 * @link     https://github.com/rewish/jquery-bgswitcher
 */
(function($) {
    'use strict';

    var loadedImages = {},

        slice = Array.prototype.slice,
        toString = Object.prototype.toString,

        corners = ['Top', 'Right', 'Bottom', 'Left'],
        backgroundProperties = [
            'Attachment', 'Color', 'Image', 'Repeat',
            'Position', 'Size', 'Clip', 'Origin'
        ];

    /**
     * jQueryプラグイン bgswitcher の定義
     *
     * this -- <div class="box" style="background: none;"></div>
     * instanceKey -- bgSwitcher
     */
    $.fn.bgswitcher = function() {
        // args -- [{interval:3000, start:true, loop:true, shuffle:false, effect:"fade",...}]
        var args = arguments,
            // BgSwitcher -- function (el){ ... }
            instanceKey = BgSwitcher.keys.instance;

        // .each -- 各要素について繰り返し処理をおこなう
        return this.each(function() {
            // thisから'bgSwitcher'というキー名で保存されたデータを読み込む
            var instance = $.data(this, instanceKey);
//			var instance;

            // もし、instanceがundefinedならば
            if (!instance) {
                // BgSwiter { ... } インスタンスを作成
                instance = new BgSwitcher(this);

                // this -- 対象となる要素
                // instanceKey -- 'bgSwitcher' -- これをキーとして要素にデータを紐付ける
                // instance -- これをデータとして紐付ける
                //   BgSwitcher(this)で生成されたインスタンス
                // thisに'bgSwitcher'というキー名でinstanceを保存する
                $.data(this, instanceKey, instance);
            }
            // apply -- instance に対して、instance.dispatch を args を
            //   引数にして適用する。
            // instance.dispatch -- すぐ下の $.extend(BgSwitcher.prototype,
            // の中のメソッド
            // args -- [{interval: 3000, start: true, loop: true, shuffle: false,effect: "fade",...}]
            instance.dispatch.apply(instance, args);
        });
    };

    // Backward Compatibility
    $.fn.bgSwitcher = $.fn.bgswitcher;

    /**
     * BgSwitcher
     *
     * @param {HTMLElement} el
     *        <div class="box" style="background: none;" ...></div> 
     * @constructor
     */
    function BgSwitcher(el) {
        this.$el = $(el);  // this.$el -- init[div.box, context: div.box]
        this.index = 0;
        this.config = $.extend({}, BgSwitcher.defaultConfig);

        this._setupBackgroundElement();
        this._listenToResize();
    }

    $.extend(BgSwitcher.prototype, {
        /**
         * Dispatch
         *   引数（要素）の型が、Objectならば、setConfigメソッドを適用する。
         *   Stringならば、配列に変換して、this[one] ... ?
         *
         * @param {string|Array} one -- args
         *    args -- [{interval: 3000, start: true, loop: true,
         *               shuffle: false,effect: "fade",...}]
         *
         * this -- BgSwitcher -- {
         *           $bg: init[div, context:div];
         *           $el: init[div.box, context: div.box]
         *           $switchable: init [div, prevObject:init(1), context:div]
         *           config: {images:Array(3), interval:3000, start:true, loop:true, shuffle:false, ...}
         *           imageList: BgSwitcher.ImageList{images:Array(5)}
         *           index: 1
         *           ...... }
         */
        dispatch: function(one) {
            // toString.call -- 型を調べる
            switch (toString.call(one)) {
                case '[object Object]':
                    this.setConfig(one);
                    break;
                case '[object String]':
                    // Array.slice(1) -- arr[1]から最後までの部分配列。
                    //      要するに、配列の先頭要素を取り除いている。
                    this[one].apply(this, slice.call(arguments, 1));
                    break;
                default:
                    throw new Error('Please specify a Object or String');
            }
        },

        /**
         * Set config
         *
         * 
         * this.config -- 下の内容に加えて、images[]が含まれている
         *      images["images/image_.jpg", 1, 5]
         *
         * @param {Object} config
         *      duration:800, easing:"swing", effedct:"fade", interval:3000,
         *      loop:true, shuffle:fase, start:true
         */
        setConfig: function(config) {
            this.config = $.extend(this.config, config);

            if (typeof this.config.random !== 'undefined') {
                this.config.shuffle = this.config.random;
            }
            // このオブジェクト（要素）が読み込み直されるのかな
            this.refresh();
        },

        /**
         * Set images
         *
         * @param {Array} images
         *        ["images/image_.jpg", 1, 5]
         */
        setImages: function(images) {

            // this.imageList =
            //   Bgswitcher.ImageList{
            //     images: ["images/image_1.jpg", "images/image_2.jpg" ...
            //              "images/image_5.jpg"]}
            this.imageList = new this.constructor.ImageList(images);

            if (this.config.shuffle) {
                this.imageList.shuffle();
            }
        },

        /**
         * Set switch handler
		 *   this（インスタンス）に対して、引数である関数を適用する
         *
         * @param {Function} fn
         *     f ($el) {
         *        $el.animate({opacity: 0}, this.config.duration,this.config.easing);
         *     }
         */
        setSwitchHandler: function(fn) {
            //
			// proxy -- オブジェクトのアクションをインターセプトしたり変更したりする（『初めてのJavaScript第3版』オライリージャパンP365）
			// @param1 -- ターゲット（プロキシされるオブジェクト）
			// @param2 -- ハンドラ（インターセプトされるアクション）
			//
			// しかし、上記の本の内容と、この場合とでは違うような気がする
			// 
			// http://js.studio-kingdom.com/jquery/utilities/proxy だと、
			// $.proxy(function, context) とあって、
			//   function -- コンテキストを変更したい関数
			//   context  -- 関数をセットするコンテキスト(this)のオブジェクト
			// とあるので、こっちが正解やな。
			//
			// つまり、この場合、this に fn を適用してるということか。
            // ここの解説がわかりやすい。
            //   http://h2ham.seesaa.net/article/142734325.html
            //
            this.switchHandler = $.proxy(fn, this);
        },

        /**
         * Default switch handler
         *   refreshメソッドのなかで呼ばれるだけ.
         *   しかも、そこでは引数はない。
         *   要するに、typeをセットするか、effectをセットするかかな。
         *
         * @param {string} type
         * @returns {Function}
         */
        getBuiltInSwitchHandler: function(type) {
            return this.constructor.switchHandlers[type || this.config.effect];
        },

        /**
         * Refresh
         *   configをthisにセットしたときに呼ばれるメソッド
         */
        refresh: function() {
            this.setImages(this.config.images);
            this.setSwitchHandler(this.getBuiltInSwitchHandler());
            this._prepareSwitching();

            if (this.config.start) {
                this.start();
            }
        },

        /**
         * Start switching
         */
        start: function() {
            if (!this._timerID) {
                // proxy -- this に next という関数を適用している
                // interval -- 5000
                // _timerID -- 1, 4, 7, 10, 13....
                this._timerID = setTimeout($.proxy(this, 'next'), this.config.interval);
            }
        },

        /**
         * Stop switching
         */
        stop: function() {
            // _timerID -- 1, 4, 7, 10...
            if (this._timerID) {
                clearTimeout(this._timerID);
                this._timerID = null;
            }
        },

        /**
         * Toggle between start/stop
         */
        toggle: function() {
            if (this._timerID) {
                this.stop();
            } else {
                this.start();
            }
        },

        /**
         * Reset switching
         */
        reset: function() {
            this.index = 0;
            this._prepareSwitching();
        },

        /**
         * Go to next switching
         */
        next: function() {
            var max = this.imageList.count();

            // config が loop でない場合
            // index + 1 が max である場合
            if (!this.config.loop && this.index + 1 === max) {
                return;
            }

            // index が max の場合は 0 とする
            if (++this.index === max) {
                this.index = 0;
            }

            this.switching();
        },

        /**
         * Go to previous switching
         */
        prev: function() {
            if (!this.config.loop && this.index === 0) {
                return;
            }

            if (--this.index === -1) {
                this.index = this.imageList.count() - 1;
            }

            this.switching();
        },

        /**
         * Select the switching at index
         *
         * @param {number} index
         */
        select: function(index) {
            if (index === -1) {
                index = this.imageList.count() - 1;
            }

            this.index = index;
            this.switching();
        },

        /**
         * Switching the background image
         */
        switching: function() {
            var started = !!this._timerID;
            // console.log(!!this._timerID);

            if (started) {
                this.stop();
            }

            this._createSwitchableElement();
            this._prepareSwitching();
            this.switchHandler(this.$switchable);

            if (started) {
                this.start();
            }
        },

        /**
         * Destroy...
         */
        destroy: function() {
            this.stop();
            this._stopListeningToResize();

            if (this.$switchable) {
                this.$switchable.stop();
                this.$switchable.remove();
                this.$switchable = null;
            }

            if (this.$bg) {
                this.$bg.remove();
                this.$bg = null;
            }

            this.$el.removeAttr('style');
            this.$el.removeData(this.constructor.keys.instance);
            this.$el = null;
        },

        /**
         * Adjust rectangle
         */
        _adjustRectangle: function() {
            var corner,
                i = 0,
                length = corners.length,
                offset = this.$el.position(),
                copiedStyles = {
                    top: offset.top,
                    left: offset.left,
                    width: this.$el.innerWidth(),
                    height: this.$el.innerHeight()
                };

            for (; i < length; i++) {
                corner = corners[i];
                copiedStyles['margin' + corner] = this.$el.css('margin' + corner);
                copiedStyles['border' + corner] = this.$el.css('border' + corner);
            }

            this.$bg.css(copiedStyles);
        },

        /**
         * Setup background element
         */
        _setupBackgroundElement: function() {
            this.$bg = $(document.createElement('div'));
            this.$bg.css({
                position: 'absolute',
                zIndex: (parseInt(this.$el.css('zIndex'), 10) || 0) - 1,
                overflow: 'hidden'
            });

            this._copyBackgroundStyles();
            this._adjustRectangle();

            if (this.$el[0].tagName === 'BODY') {
                this.$el.prepend(this.$bg);
            } else {
                this.$el.before(this.$bg);
                this.$el.css('background', 'none');
            }
        },

        /**
         * Create switchable element
         */
        _createSwitchableElement: function() {
            if (this.$switchable) {
                this.$switchable.remove();
            }

            // $bg -- init {div, context:div}
            // $bg.clone() -- init {div, prevObject:init(1), context:div}
            // clone() -- 要素のクローンを作成し、そのクローンを選択状態にする
            this.$switchable = this.$bg.clone();
            
            this.$switchable.css({top: 0, left: 0, margin: 0, border: 'none'});
            
            // appendTo -- 要素の中身を他の要素に追加する。
            // $(A).appendTo(B) -- BにAが追加される。
            // $bg に $switchable を追加する。
            this.$switchable.appendTo(this.$bg);
        },

        /**
         * Copy background styles
         */
        _copyBackgroundStyles: function () {
            var prop,
                copiedStyle = {},
                i = 0,
                length = backgroundProperties.length,
                backgroundPosition = 'backgroundPosition';

            for (; i < length; i++) {
                // backgroundProperties[i] --
                //   Attachment
                //   Color
                //   Image
                //   Repeat
                //   Position
                //   Size
                //   Clip
                //   Origin
                prop = 'background' + backgroundProperties[i];
                copiedStyle[prop] = this.$el.css(prop);
            }

            // For IE<=9
            if (copiedStyle[backgroundPosition] === undefined) {
                copiedStyle[backgroundPosition] = [
                    this.$el.css(backgroundPosition + 'X'),
                    this.$el.css(backgroundPosition + 'Y')
                ].join(' ');
            }

            this.$bg.css(copiedStyle);
        },

        /**
         * Listen to the resize event
         */
        _listenToResize: function() {
            var that = this;
            this._resizeHandler = function() {
                that._adjustRectangle();
            };
            $(window).on('resize', this._resizeHandler);
        },

        /**
         * Stop listening to the resize event
         */
        _stopListeningToResize: function() {
            $(window).off('resize', this._resizeHandler);
            this._resizeHandler = null;
        },

        /**
         * Prepare the Switching
         *
         * this.index -- 0, 1, 2, 3, 4
         */
        _prepareSwitching: function() {
            this.$bg.css('backgroundImage', this.imageList.url(this.index));
            // console.log(this.imageList.url(this.index));
        }
    }); // BgSwitcher.prototype

    /**
     * Data Keys
     * @type {Object}
     */
    BgSwitcher.keys = {
        instance: 'bgSwitcher'
    };

    /**
     * Default Config
     * @type {Object}
     */
    BgSwitcher.defaultConfig = {
        images: [],
        interval: 5000,
        start: true,
        loop: true,
        shuffle: false,
        effect: 'fade',
        duration: 1000,
        easing: 'swing'
    };

    /**
     * Built-In switch handlers (effects)
     * @type {Object}
     */
    BgSwitcher.switchHandlers = {
        fade: function($el) {
            $el.animate({opacity: 0}, this.config.duration, this.config.easing);
        },

        blind: function($el) {
            $el.animate({height: 0}, this.config.duration, this.config.easing);
        },

        clip: function($el) {
            $el.animate({
                top: parseInt($el.css('top'), 10) + $el.height() / 2,
                height: 0
            }, this.config.duration, this.config.easing);
        },

        slide: function($el) {
            $el.animate({top: -$el.height()}, this.config.duration, this.config.easing);
        },

        drop: function($el) {
            $el.animate({
                left: -$el.width(),
                opacity: 0
            }, this.config.duration, this.config.easing);
        },

        hide: function($el) {
            $el.hide();
        }
    };

    /**
     * Define effect
     *
     * @param {String} name
     * @param {Function} fn
     */
    BgSwitcher.defineEffect = function(name, fn) {
        console.log(name);
        this.switchHandlers[name] = fn;
    };

    /**
     * BgSwitcher.ImageList
     *
     * これが、画像をセットしている本体部分
     *
     * @param {Array} images
     * @constructor
     */
    BgSwitcher.ImageList = function(images) {
        this.images = images;
        this.createImagesBySequence();
        this.preload();
    };

    $.extend(BgSwitcher.ImageList.prototype, {
        /**
         * Images is sequenceable
         *
         * @returns {boolean}
         */
        isSequenceable: function() {
            return typeof this.images[0] === 'string' &&
                   typeof this.images[1] === 'number' &&
                   typeof this.images[2] === 'number';
        },

        /**
         * Create an images by sequence
         * ここで、this.images に１〜５の画像をセットしている
         */
        createImagesBySequence: function() {
            if (!this.isSequenceable()) {
                return;
            }

            var images = [],
                base = this.images[0], // 'images/image_.jpg'
                min = this.images[1],  // 1
                max = this.images[2];  // 5

            do {
                // base = 'images/image_.jpg'
                // min = 1, 2, 3, 4, 5
                // $& -- マッチした文字列全体
                images.push(base.replace(/\.\w+$/, min + '$&'));
            } while (++min <= max);

            // this.images -- ['images/image_.jpg', 1, 5]
            // これを ['images/image_1.jpg', ...] にしている
            this.images = images;
        },

        /**
         * Preload an images
         * まず、<img>要素を作成。それを loadedImage[path] に格納
         * loadedImages[path].src に path をセット。... ?
         */
        preload: function() {
            var path,
                length = this.images.length,
                i = 0;

            for (; i < length; i++) {
                // this.images[i] -- 'images/image_1.jpg' ...
                path = this.images[i];
                if (!loadedImages[path]) {
                    // Image() -- <img src="">要素を作成する
                    loadedImages[path] = new Image();
                    // loadedImages[path] -- <img src="images/image_1.jpg">
                    // loadedImages[path].src -- file://からの image_1.jpgのフルパス
                    loadedImages[path].src = path;
                }
            }
        },

        /**
         * Shuffle an images
         */
        shuffle: function() {
            var j, t,
                i = this.images.length,
                original = this.images.join();

            if (!i) {
                return;
            }

            while (i) {
                j = Math.floor(Math.random() * i);
                t = this.images[--i];
                this.images[i] = this.images[j];
                this.images[j] = t;
            }

            if (this.images.join() === original) {
                this.shuffle();
            }
        },

        /**
         * Get the image from index
         *
         * @param {number} index -- 0, 1, 2, 3, 4
         * @returns {string} -- 'images/image_1.jpg'
         */
        get: function(index) {
            // images[index] -- 'images/image_1.jpg' ...
            return this.images[index];
        },

        /**
         * Get the URL with function of CSS
         *
         * @param {number} index -- 0, 1, 2, 3, 4
         * @returns {string} -- 'url(images/image_1.jpg)'
         */
        url: function(index) {
            // get(index) -- "images/image_1.jpg" ...
            return 'url(' + this.get(index) + ')';
        },

        /**
         * Count of images
         *
         * @returns {number}
         */
        count: function() {
            return this.images.length;
        }
    });

    $.BgSwitcher = BgSwitcher;
}(jQuery));
