'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _scroll = require('scroll');

var _scroll2 = _interopRequireDefault(_scroll);

var _Beacon = require('./Beacon');

var _Beacon2 = _interopRequireDefault(_Beacon);

var _Tooltip = require('./Tooltip');

var _Tooltip2 = _interopRequireDefault(_Tooltip);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var defaultState = {
  index: 0,
  play: false,
  showTooltip: false,
  xPos: -1000,
  yPos: -1000,
  skipped: false
};
var listeners = {
  tooltips: {}
};
var isTouch = 'ontouchstart' in window || navigator.msMaxTouchPoints;

var Component = function (_React$Component) {
  _inherits(Component, _React$Component);

  function Component(props) {
    _classCallCheck(this, Component);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Component).call(this, props));

    _this.displayName = 'Joyride';
    _this.state = defaultState;
    return _this;
  }

  _createClass(Component, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      var _this2 = this;

      var props = this.props;

      this._log('joyride:initialized', [props]);

      if (props.resizeDebounce) {
        (function () {
          var timeoutId = void 0;

          listeners.resize = function () {
            return function () {
              clearTimeout(timeoutId);
              timeoutId = setTimeout(function () {
                timeoutId = null;
                _this2._calcPlacement();
              }, props.resizeDebounceDelay);
            };
          }();
        })();
      } else {
        listeners.resize = this._calcPlacement;
      }
      window.addEventListener('resize', listeners.resize);

      if (props.keyboardNavigation) {
        listeners.keyboard = this._keyboardNavigation;
        document.body.addEventListener('keydown', listeners.keyboard);
      }
    }
  }, {
    key: 'componentWillReceiveProps',
    value: function componentWillReceiveProps(nextProps) {
      var props = this.props;
      this._log('joyride: willReceiveProps', [nextProps]);

      if (nextProps.steps.length !== props.steps.length) {
        this._log('joyride:changedSteps', [nextProps.steps]);

        if (!nextProps.steps.length) {
          this.reset();
        } else if (nextProps.run) {
          this.reset(true);
        }
      }

      if (!props.run && nextProps.run && nextProps.steps.length) {
        this.start();
      } else if (props.run && nextProps.run === false) {
        this.stop();
      }
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps, prevState) {
      var state = this.state;
      var props = this.props;

      if ((state.tooltip || state.play && props.steps[state.index]) && state.xPos < 0) {
        this._calcPlacement();
      }

      if (state.play && props.scrollToSteps && (props.scrollToFirstStep || state.index > 0 || prevState.index > state.index)) {
        _scroll2.default.top(this._getBrowser() === 'firefox' ? document.documentElement : document.body, this._getScrollTop());
      }
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      window.removeEventListener('resize', listeners.resize);

      if (this.props.keyboardNavigation) {
        document.body.removeEventListener('keydown', listeners.keyboard);
      }

      if (Object.keys(listeners.tooltips).length) {
        Object.keys(listeners.tooltips).forEach(function (key) {
          document.querySelector(key).removeEventListener(listeners.tooltips[key].event, listeners.tooltips[key].cb);
          delete listeners.tooltips[key];
        });
      }
    }

    /**
     * Starts the tour
     * @param {boolean} [autorun]- Starts with the first tooltip opened
     */

  }, {
    key: 'start',
    value: function start(autorun) {
      var _this3 = this;

      var autoStart = autorun === true;

      this._log('joyride:start', ['autorun:', autoStart]);

      this.setState({
        play: true
      }, function () {
        if (autoStart) {
          _this3._toggleTooltip(true);
        }
      });
    }

    /**
     * Stop the tour
     */

  }, {
    key: 'stop',
    value: function stop() {
      this._log('joyride:stop');

      this.setState({
        showTooltip: false,
        play: false
      });
    }

    /**
     * Reset Tour
     * @param {boolean} [restart] - Starts the new tour right away
     */

  }, {
    key: 'reset',
    value: function reset(restart) {
      var shouldRestart = restart === true;

      var newState = JSON.parse(JSON.stringify(defaultState));
      newState.play = shouldRestart;

      this._log('joyride:reset', ['restart:', shouldRestart]);

      // Force a re-render if necessary
      if (shouldRestart && this.state.play === shouldRestart && this.state.index === 0) {
        this.forceUpdate();
      }

      this.setState(newState);
    }

    /**
     * Retrieve the current progress of your tour
     * @returns {{index: (number|*), percentageComplete: number, step: (object|null)}}
     */

  }, {
    key: 'getProgress',
    value: function getProgress() {
      var state = this.state;
      var props = this.props;

      this._log('joyride:getProgress', ['steps:', props.steps]);

      return {
        index: state.index,
        percentageComplete: parseFloat((state.index / props.steps.length * 100).toFixed(2).replace('.00', '')),
        step: props.steps[state.index]
      };
    }

    /**
     * Parse the incoming steps
     * @param {Array|Object} steps
     * @returns {Array}
     */

  }, {
    key: 'parseSteps',
    value: function parseSteps(steps) {
      var _this4 = this;

      var newSteps = [];
      var tmpSteps = [];
      var el = void 0;

      if (Array.isArray(steps)) {
        steps.forEach(function (s) {
          if (s instanceof Object) {
            tmpSteps.push(s);
          }
        });
      } else {
        tmpSteps = [steps];
      }

      tmpSteps.forEach(function (s) {
        if (s.selector.dataset && s.selector.dataset.reactid) {
          s.selector = '[data-reactid="' + s.selector.dataset.reactid + '"]';
          console.warn('Deprecation warning: React 15.0 removed reactid. Update your code.'); //eslint-disable-line no-console
        } else if (s.selector.dataset) {
            console.error('Unsupported error: React 15.0+ don\'t write reactid to the DOM anymore, please use a plain class in your step.', s); //eslint-disable-line no-console
            if (s.selector.className) {
              s.selector = '.' + s.selector.className.replace(' ', '.');
            }
          }

        el = document.querySelector(s.selector);
        s.position = s.position || 'top';

        if (el && el.offsetParent) {
          newSteps.push(s);
        } else {
          _this4._log('joyride:parseSteps', ['Element not rendered in the DOM. Skipped..', s], true);
        }
      });

      return newSteps;
    }
  }, {
    key: 'addTooltip',
    value: function addTooltip(data) {
      var parseData = this.parseSteps(data);
      var newData = void 0;
      var el = void 0;
      var eventType = void 0;
      var key = void 0;

      this._log('joyride:addTooltip', ['data:', data]);

      if (parseData.length) {
        newData = parseData[0];
        key = newData.trigger || newData.selector;
        el = document.querySelector(key);
        eventType = newData.event || 'click';
      }

      el.dataset.tooltip = JSON.stringify(data);

      if (eventType === 'hover' && !isTouch) {
        listeners.tooltips[key] = { event: 'mouseenter', cb: this._onTooltipTrigger };
        listeners.tooltips[key + 'mouseleave'] = { event: 'mouseleave', cb: this._onTooltipTrigger };
        listeners.tooltips[key + 'click'] = {
          event: 'click', cb: function cb(e) {
            e.preventDefault();
          }
        };

        el.addEventListener('mouseenter', listeners.tooltips[key].cb);
        el.addEventListener('mouseleave', listeners.tooltips[key + 'mouseleave'].cb);
        el.addEventListener('click', listeners.tooltips[key + 'click'].cb);
      } else {
        listeners.tooltips[key] = { event: 'click', cb: this._onTooltipTrigger };
        el.addEventListener('click', listeners.tooltips[key].cb);
      }
    }
  }, {
    key: '_log',
    value: function _log(type, msg, warn) {
      var logger = warn ? console.warn || console.error : console.log; //eslint-disable-line no-console

      if (this.props.debug) {
        console.log('%c' + type, 'color: #005590; font-weight: bold'); //eslint-disable-line no-console
        if (msg) {
          logger.apply(console, msg);
        }
      }
    }

    /**
     * Returns the current browser
     * @private
     * @returns {String}
     */

  }, {
    key: '_getBrowser',
    value: function _getBrowser() {
      // Return cached result if avalible, else get result then cache it.
      if (this._browser) {
        return this._browser;
      }

      var isOpera = Boolean(window.opera) || navigator.userAgent.indexOf(' OPR/') >= 0;
      // Opera 8.0+ (UA detection to detect Blink/v8-powered Opera)
      var isFirefox = typeof InstallTrigger !== 'undefined'; // Firefox 1.0+
      var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
      // At least Safari 3+: "[object HTMLElementConstructor]"
      var isChrome = Boolean(window.chrome) && !isOpera; // Chrome 1+
      var isIE = /*@cc_on!@*/Boolean(document.documentMode); // At least IE6

      return this._browser = isOpera ? 'opera' : isFirefox ? 'firefox' : isSafari ? 'safari' : isChrome ? 'chrome' : isIE ? 'ie' : '';
    }

    /**
     * Get an element actual dimensions with margin
     * @param {String|Element} el - Element node or selector
     * @returns {{height: number, width: number}}
     */

  }, {
    key: '_getElementDimensions',
    value: function _getElementDimensions(el) {
      // Get the DOM Node if you pass in a string
      var newEl = typeof el === 'string' ? document.querySelector(el) : el;

      var styles = window.getComputedStyle(newEl);
      var height = newEl.clientHeight + parseInt(styles.marginTop, 10) + parseInt(styles.marginBottom, 10);
      var width = newEl.clientWidth + parseInt(styles.marginLeft, 10) + parseInt(styles.marginRight, 10);

      return {
        height: height,
        width: width
      };
    }

    /**
     * Get the scrollTop position
     * @returns {number}
     */

  }, {
    key: '_getScrollTop',
    value: function _getScrollTop() {
      var state = this.state;
      var props = this.props;
      var step = props.steps[state.index];
      var position = step.position;
      var target = document.querySelector(step.selector);
      var targetTop = target.getBoundingClientRect().top + document.body.scrollTop;
      var scrollTop = 0;

      if (/^top/.test(position) || state.position === 'top') {
        scrollTop = Math.floor(state.yPos - props.scrollOffset);
      } else if (/^bottom|^left|^right/.test(position)) {
        scrollTop = Math.floor(targetTop - props.scrollOffset);
      }

      return scrollTop;
    }

    /**
     * Keydown event listener
     * @param {Event} e - Keyboard event
     */

  }, {
    key: '_keyboardNavigation',
    value: function _keyboardNavigation(e) {
      var state = this.state;
      var props = this.props;
      var intKey = window.Event ? e.which : e.keyCode;
      var hasSteps = void 0;

      if (state.showTooltip) {
        if ([32, 38, 40].indexOf(intKey) > -1) {
          e.preventDefault();
        }

        if (intKey === 27) {
          this._toggleTooltip(false, state.index + 1);
        } else if ([13, 32].indexOf(intKey) > -1) {
          hasSteps = Boolean(props.steps[state.index + 1]);
          this._toggleTooltip(hasSteps, state.index + 1, 'next');
        }
      }
    }

    /**
     * Tooltip event listener
     * @param {Event} e - Click event
     */

  }, {
    key: '_onTooltipTrigger',
    value: function _onTooltipTrigger(e) {
      e.preventDefault();
      var tooltip = e.currentTarget.dataset.tooltip;

      if (tooltip) {
        tooltip = JSON.parse(tooltip);

        if (!this.state.tooltip || this.state.tooltip.selector !== tooltip.selector) {
          this.setState({
            previousPlay: this.state.previousPlay !== undefined ? this.state.previousPlay : this.state.play,
            play: false,
            showTooltip: false,
            tooltip: tooltip,
            xPos: -1000,
            yPos: -1000
          });
        } else {
          document.querySelector('.joyride-tooltip__close').click();
        }
      }
    }

    /**
     * Beacon click event listener
     * @param {Event} e - Click event
     */

  }, {
    key: '_onBeaconTrigger',
    value: function _onBeaconTrigger(e) {
      e.preventDefault();
      this._toggleTooltip(true, this.state.index);
    }

    /**
     * Tooltip click event listener
     * @param {Event} e - Click event
     */

  }, {
    key: '_onClickTooltip',
    value: function _onClickTooltip(e) {
      e.preventDefault();
      e.stopPropagation();

      var state = this.state;
      var props = this.props;
      var tooltip = document.querySelector('.joyride-tooltip');
      var el = e.target;
      var type = el.dataset.type;
      var newIndex = state.index + (type === 'back' ? -1 : 1);

      if (type === 'skip') {
        this.setState({
          skipped: true
        });
        newIndex = props.steps.length + 1;
      }

      if (tooltip.classList.contains('joyride-tooltip--standalone')) {
        this.setState({
          play: this.state.previousPlay,
          previousPlay: undefined,
          tooltip: undefined,
          xPos: -1000,
          yPos: -1000
        });
      } else if (type) {
        this._toggleTooltip((props.type === 'continuous' || props.type === 'guided') && ['close', 'skip'].indexOf(type) === -1 && Boolean(props.steps[newIndex]), newIndex, type);
      }
    }

    /**
     * Toggle Tooltip's visibility
     * @param {Boolean} show - Render the tooltip directly or the beacon
     * @param {Number} [index] - The tour's new index
     * @param {string} [action]
     */

  }, {
    key: '_toggleTooltip',
    value: function _toggleTooltip(show, index, action) {
      var _this5 = this;

      var newIndex = index !== undefined ? index : this.state.index;
      var props = this.props;

      this.setState({
        play: props.steps[newIndex] ? this.state.play : false,
        showTooltip: show,
        index: newIndex,
        xPos: -1000,
        yPos: -1000
      }, function () {
        var lastIndex = action === 'back' ? newIndex + 1 : newIndex - 1;

        if (action && typeof props.stepCallback === 'function' && props.steps[lastIndex]) {
          props.stepCallback(props.steps[lastIndex]);
        }

        if (props.steps.length && !props.steps[newIndex]) {
          if (typeof props.completeCallback === 'function') {
            props.completeCallback(props.steps, _this5.state.skipped);
          }
        }
      });
    }

    /**
     * Position absolute elements next to its target
     */

  }, {
    key: '_calcPlacement',
    value: function _calcPlacement() {
      var state = this.state;
      var props = this.props;
      var step = state.tooltip ? state.tooltip : props.steps[state.index];
      var showTooltip = state.tooltip ? true : state.showTooltip;
      var placement = {
        x: -1000,
        y: -1000
      };
      var component = void 0;
      var position = void 0;
      var body = void 0;
      var target = void 0;

      if (step) {
        position = step.position;
        body = document.body.getBoundingClientRect();
        target = document.querySelector(step.selector).getBoundingClientRect();
        component = this._getElementDimensions(showTooltip ? '.joyride-tooltip' : '.joyride-beacon');

        // Change the step position in the tooltip won't fit in the window
        if (/^left/.test(position) && target.left - (component.width + props.tooltipOffset) < 0) {
          position = 'top';
        } else if (/^right/.test(position) && target.left + target.width + (component.width + props.tooltipOffset) > body.width) {
          position = 'bottom';
        }

        // Calculate x position
        if (/^left/.test(position)) {
          placement.x = target.left - (showTooltip ? component.width + props.tooltipOffset : component.width / 2);
        } else if (/^right/.test(position)) {
          placement.x = target.left + target.width - (showTooltip ? -props.tooltipOffset : component.width / 2);
        } else {
          placement.x = target.left + target.width / 2 - component.width / 2;
        }

        // Calculate y position
        if (/^top/.test(position)) {
          placement.y = target.top - body.top - (showTooltip ? component.height + props.tooltipOffset : component.height / 2);
        } else if (/^bottom/.test(position)) {
          placement.y = target.top - body.top + target.height - (showTooltip ? -props.tooltipOffset : component.height / 2);
        } else {
          placement.y = target.top - body.top + target.height / 2 - component.height / 2 + (showTooltip ? props.tooltipOffset : 0);
        }

        if (/^bottom|^top/.test(position)) {
          if (/left/.test(position)) {
            placement.x = target.left - (showTooltip ? props.tooltipOffset : component.width / 2);
          } else if (/right/.test(position)) {
            placement.x = target.left + target.width - (showTooltip ? component.width - props.tooltipOffset : component.width / 2);
          }
        }

        this.setState({
          xPos: this._preventWindowOverflow(Math.ceil(placement.x), 'x', component.width, component.height),
          yPos: this._preventWindowOverflow(Math.ceil(placement.y), 'y', component.width, component.height),
          position: position
        });
      }
    }

    /**
     * Prevent tooltip to render outside the window
     * @param {Number} value - The axis position
     * @param {String} axis - The Axis X or Y
     * @param {Number} elWidth - The target element width
     * @param {Number} elHeight - The target element height
     * @returns {Number}
     */

  }, {
    key: '_preventWindowOverflow',
    value: function _preventWindowOverflow(value, axis, elWidth, elHeight) {
      var winWidth = window.innerWidth;
      var docHeight = document.body.offsetHeight;
      var newValue = value;

      if (axis === 'x') {
        if (value + elWidth >= winWidth) {
          newValue = winWidth - elWidth - 15;
        } else if (value < 15) {
          newValue = 15;
        }
      } else if (axis === 'y') {
        if (value + elHeight >= docHeight) {
          newValue = docHeight - elHeight - 15;
        } else if (value < 15) {
          newValue = 15;
        }
      }

      return newValue;
    }

    /**
     *
     * @param {Boolean} [update]
     * @returns {*}
     * @private
     */

  }, {
    key: '_createComponent',
    value: function _createComponent(update) {
      var state = this.state;
      var props = this.props;
      var currentStep = Object.assign({}, state.tooltip || props.steps[state.index]);
      var buttons = {
        primary: props.locale.close
      };
      var target = currentStep && currentStep.selector ? document.querySelector(currentStep.selector) : null;
      var cssPosition = target ? target.style.position : null;
      var showOverlay = state.tooltip ? false : props.showOverlay;
      var component = void 0;

      this._log('joyride:' + (update ? 'sizeComponent' : 'renderComponent'), ['component:', state.showTooltip || state.tooltip ? 'Tooltip' : 'Beacon', 'target:', target]);

      if (target) {
        if (state.showTooltip || state.tooltip) {
          currentStep.position = state.position;

          if (!state.tooltip) {
            if (props.type === 'continuous' || props.type === 'guided') {
              buttons.primary = props.locale.last;

              if (props.steps[state.index + 1]) {
                buttons.primary = props.locale.next;

                if (props.showStepsProgress) {
                  buttons.primary += ' ' + (state.index + 1) + '/' + props.steps.length;
                }
              }

              if (props.showBackButton && state.index > 0) {
                buttons.secondary = props.locale.back;
              }
            }

            if (props.showSkipButton) {
              buttons.skip = props.locale.skip;
            }
          }

          component = _react2.default.createElement(_Tooltip2.default, {
            animate: state.xPos > -1,
            browser: this._getBrowser(),
            buttons: buttons,
            cssPosition: cssPosition,
            showOverlay: showOverlay,
            step: currentStep,
            standalone: Boolean(state.tooltip),
            type: props.type,
            xPos: state.xPos,
            yPos: state.yPos,
            onClick: this._onClickTooltip
          });
        } else {
          component = _react2.default.createElement(_Beacon2.default, {
            cssPosition: cssPosition,
            step: currentStep,
            xPos: state.xPos,
            yPos: state.yPos,
            onTrigger: this._onBeaconTrigger,
            eventType: currentStep.type || 'click'
          });
        }
      }

      return component;
    }
  }, {
    key: 'render',
    value: function render() {
      var state = this.state;
      var props = this.props;
      var hasStep = Boolean(props.steps[state.index]);
      var component = void 0;
      var standaloneTooltip = void 0;

      if (state.play && state.xPos < 0 && hasStep) {
        this._log('joyride:render', ['step:', props.steps[state.index]]);
      } else if (!state.play && state.tooltip) {
        this._log('joyride:render', ['tooltip:', state.tooltip]);
      }

      if (state.tooltip) {
        standaloneTooltip = this._createComponent();
      } else if (state.play && hasStep) {
        component = this._createComponent(state.xPos < 0);
      }

      return _react2.default.createElement(
        'div',
        { className: 'joyride' },
        component,
        standaloneTooltip
      );
    }
  }]);

  return Component;
}(_react2.default.Component);

Component.propTypes = {
  completeCallback: _react2.default.PropTypes.func,
  debug: _react2.default.PropTypes.bool,
  keyboardNavigation: _react2.default.PropTypes.bool,
  locale: _react2.default.PropTypes.object,
  resizeDebounce: _react2.default.PropTypes.bool,
  resizeDebounceDelay: _react2.default.PropTypes.number,
  run: _react2.default.PropTypes.bool,
  scrollOffset: _react2.default.PropTypes.number,
  scrollToFirstStep: _react2.default.PropTypes.bool,
  scrollToSteps: _react2.default.PropTypes.bool,
  showBackButton: _react2.default.PropTypes.bool,
  showOverlay: _react2.default.PropTypes.bool,
  showSkipButton: _react2.default.PropTypes.bool,
  showStepsProgress: _react2.default.PropTypes.bool,
  stepCallback: _react2.default.PropTypes.func,
  steps: _react2.default.PropTypes.array,
  tooltipOffset: _react2.default.PropTypes.number,
  type: _react2.default.PropTypes.string
};
Component.defaultProps = {
  debug: false,
  keyboardNavigation: true,
  locale: {
    back: 'Back',
    close: 'Close',
    last: 'Last',
    next: 'Next',
    skip: 'Skip'
  },
  resizeDebounce: false,
  resizeDebounceDelay: 200,
  run: false,
  scrollToSteps: true,
  scrollOffset: 20,
  scrollToFirstStep: false,
  showBackButton: true,
  showOverlay: true,
  showSkipButton: false,
  showStepsProgress: false,
  steps: [],
  tooltipOffset: 15,
  type: 'casual',
  completeCallback: undefined,
  stepCallback: undefined
};
exports.default = Component;