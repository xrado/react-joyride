import React from 'react';
import scroll from 'scroll';
import Beacon from './Beacon';
import Tooltip from './Tooltip';

const defaultState = {
  index: 0,
  play: false,
  showTooltip: false,
  xPos: -1000,
  yPos: -1000,
  skipped: false
};
const listeners = {
  tooltips: {}
};
const isTouch = 'ontouchstart' in window || navigator.msMaxTouchPoints;

export default class Component extends React.Component {
  constructor(props) {
    super(props);

    this.displayName = 'Joyride';
    this.state = defaultState;
  }

  static propTypes = {
    completeCallback: React.PropTypes.func,
    debug: React.PropTypes.bool,
    keyboardNavigation: React.PropTypes.bool,
    locale: React.PropTypes.object,
    resizeDebounce: React.PropTypes.bool,
    resizeDebounceDelay: React.PropTypes.number,
    run: React.PropTypes.bool,
    scrollOffset: React.PropTypes.number,
    scrollToFirstStep: React.PropTypes.bool,
    scrollToSteps: React.PropTypes.bool,
    showBackButton: React.PropTypes.bool,
    showOverlay: React.PropTypes.bool,
    showSkipButton: React.PropTypes.bool,
    showStepsProgress: React.PropTypes.bool,
    stepCallback: React.PropTypes.func,
    steps: React.PropTypes.array,
    tooltipOffset: React.PropTypes.number,
    type: React.PropTypes.string
  };

  static defaultProps = {
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

  componentDidMount() {
    const props = this.props;

    this._log('joyride:initialized', [props]);

    if (props.resizeDebounce) {
      let timeoutId;

      listeners.resize = (() =>
        () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            timeoutId = null;
            this._calcPlacement();
          }, props.resizeDebounceDelay);
        })();
    }
    else {
      listeners.resize = this._calcPlacement;
    }
    window.addEventListener('resize', listeners.resize);

    if (props.keyboardNavigation) {
      listeners.keyboard = this._keyboardNavigation;
      document.body.addEventListener('keydown', listeners.keyboard);
    }
  }

  componentWillReceiveProps(nextProps) {
    const props = this.props;
    this._log('joyride: willReceiveProps', [nextProps]);

    if (nextProps.steps.length !== props.steps.length) {
      this._log('joyride:changedSteps', [nextProps.steps]);

      if (!nextProps.steps.length) {
        this.reset();
      }
      else if (nextProps.run) {
        this.reset(true);
      }
    }

    if (!props.run && nextProps.run && nextProps.steps.length) {
      this.start();
    }
    else if (props.run && nextProps.run === false) {
      this.stop();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const state = this.state;
    const props = this.props;

    if ((state.tooltip || (state.play && props.steps[state.index])) && state.xPos < 0) {
      this._calcPlacement();
    }

    if (state.play && props.scrollToSteps && (props.scrollToFirstStep || (state.index > 0 || prevState.index > state.index))) {
      scroll.top(this._getBrowser() === 'firefox' ? document.documentElement : document.body, this._getScrollTop());
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', listeners.resize);

    if (this.props.keyboardNavigation) {
      document.body.removeEventListener('keydown', listeners.keyboard);
    }

    if (Object.keys(listeners.tooltips).length) {
      Object.keys(listeners.tooltips).forEach((key) => {
        document.querySelector(key).removeEventListener(listeners.tooltips[key].event, listeners.tooltips[key].cb);
        delete listeners.tooltips[key];
      });
    }
  }

  /**
   * Starts the tour
   * @param {boolean} [autorun]- Starts with the first tooltip opened
   */
  start(autorun) {
    const autoStart = autorun === true;

    this._log('joyride:start', ['autorun:', autoStart]);

    this.setState({
      play: true
    }, () => {
      if (autoStart) {
        this._toggleTooltip(true);
      }
    });
  }

  /**
   * Stop the tour
   */
  stop() {
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
  reset(restart) {
    const shouldRestart = restart === true;

    const newState = JSON.parse(JSON.stringify(defaultState));
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
  getProgress() {
    const state = this.state;
    const props = this.props;

    this._log('joyride:getProgress', ['steps:', props.steps]);

    return {
      index: state.index,
      percentageComplete: parseFloat(((state.index / props.steps.length) * 100).toFixed(2).replace('.00', '')),
      step: props.steps[state.index]
    };
  }

  /**
   * Parse the incoming steps
   * @param {Array|Object} steps
   * @returns {Array}
   */
  parseSteps(steps) {
    const newSteps = [];
    let tmpSteps = [];
    let el;

    if (Array.isArray(steps)) {
      steps.forEach((s) => {
        if (s instanceof Object) {
          tmpSteps.push(s);
        }
      });
    }
    else {
      tmpSteps = [steps];
    }

    tmpSteps.forEach((s) => {
      if (s.selector.dataset && s.selector.dataset.reactid) {
        s.selector = `[data-reactid="${s.selector.dataset.reactid}"]`;
        console.warn('Deprecation warning: React 15.0 removed reactid. Update your code.'); //eslint-disable-line no-console
      }
      else if (s.selector.dataset) {
        console.error('Unsupported error: React 15.0+ don\'t write reactid to the DOM anymore, please use a plain class in your step.', s); //eslint-disable-line no-console
        if (s.selector.className) {
          s.selector = `.${s.selector.className.replace(' ', '.')}`;
        }
      }

      el = document.querySelector(s.selector);
      s.position = s.position || 'top';

      if (el && el.offsetParent) {
        newSteps.push(s);
      }
      else {
        this._log('joyride:parseSteps', ['Element not rendered in the DOM. Skipped..', s], true);
      }
    });

    return newSteps;
  }

  addTooltip(data) {
    const parseData = this.parseSteps(data);
    let newData;
    let el;
    let eventType;
    let key;

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
      listeners.tooltips[`${key}mouseleave`] = { event: 'mouseleave', cb: this._onTooltipTrigger };
      listeners.tooltips[`${key}click`] = {
        event: 'click', cb: (e) => {
          e.preventDefault();
        }
      };

      el.addEventListener('mouseenter', listeners.tooltips[key].cb);
      el.addEventListener('mouseleave', listeners.tooltips[`${key}mouseleave`].cb);
      el.addEventListener('click', listeners.tooltips[`${key}click`].cb);
    }
    else {
      listeners.tooltips[key] = { event: 'click', cb: this._onTooltipTrigger };
      el.addEventListener('click', listeners.tooltips[key].cb);
    }
  }

  _log(type, msg, warn) {
    const logger = warn ? console.warn || console.error : console.log; //eslint-disable-line no-console

    if (this.props.debug) {
      console.log(`%c${type}`, 'color: #005590; font-weight: bold'); //eslint-disable-line no-console
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
  _getBrowser() {
    // Return cached result if avalible, else get result then cache it.
    if (this._browser) {
      return this._browser;
    }

    const isOpera = Boolean(window.opera) || navigator.userAgent.indexOf(' OPR/') >= 0;
    // Opera 8.0+ (UA detection to detect Blink/v8-powered Opera)
    const isFirefox = typeof InstallTrigger !== 'undefined';// Firefox 1.0+
    const isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
    // At least Safari 3+: "[object HTMLElementConstructor]"
    const isChrome = Boolean(window.chrome) && !isOpera;// Chrome 1+
    const isIE = /*@cc_on!@*/ Boolean(document.documentMode); // At least IE6

    return (this._browser =
      isOpera ? 'opera' :
      isFirefox ? 'firefox' :
      isSafari ? 'safari' :
      isChrome ? 'chrome' :
      isIE ? 'ie' :
      '');
  }

  /**
   * Get an element actual dimensions with margin
   * @param {String|Element} el - Element node or selector
   * @returns {{height: number, width: number}}
   */
  _getElementDimensions(el) {
    // Get the DOM Node if you pass in a string
    const newEl = (typeof el === 'string') ? document.querySelector(el) : el;

    const styles = window.getComputedStyle(newEl);
    const height = newEl.clientHeight + parseInt(styles.marginTop, 10) + parseInt(styles.marginBottom, 10);
    const width = newEl.clientWidth + parseInt(styles.marginLeft, 10) + parseInt(styles.marginRight, 10);

    return {
      height,
      width
    };
  }

  /**
   * Get the scrollTop position
   * @returns {number}
   */
  _getScrollTop() {
    const state = this.state;
    const props = this.props;
    const step = props.steps[state.index];
    const position = step.position;
    const target = document.querySelector(step.selector);
    const targetTop = target.getBoundingClientRect().top + document.body.scrollTop;
    let scrollTop = 0;

    if (/^top/.test(position) || state.position === 'top') {
      scrollTop = Math.floor(state.yPos - props.scrollOffset);
    }
    else if (/^bottom|^left|^right/.test(position)) {
      scrollTop = Math.floor(targetTop - props.scrollOffset);
    }

    return scrollTop;
  }

  /**
   * Keydown event listener
   * @param {Event} e - Keyboard event
   */
  _keyboardNavigation(e) {
    const state = this.state;
    const props = this.props;
    const intKey = (window.Event) ? e.which : e.keyCode;
    let hasSteps;

    if (state.showTooltip) {
      if ([32, 38, 40].indexOf(intKey) > -1) {
        e.preventDefault();
      }

      if (intKey === 27) {
        this._toggleTooltip(false, state.index + 1);
      }
      else if ([13, 32].indexOf(intKey) > -1) {
        hasSteps = Boolean(props.steps[state.index + 1]);
        this._toggleTooltip(hasSteps, state.index + 1, 'next');
      }
    }
  }

  /**
   * Tooltip event listener
   * @param {Event} e - Click event
   */
  _onTooltipTrigger(e) {
    e.preventDefault();
    let tooltip = e.currentTarget.dataset.tooltip;

    if (tooltip) {
      tooltip = JSON.parse(tooltip);

      if (!this.state.tooltip || (this.state.tooltip.selector !== tooltip.selector)) {
        this.setState({
          previousPlay: this.state.previousPlay !== undefined ? this.state.previousPlay : this.state.play,
          play: false,
          showTooltip: false,
          tooltip,
          xPos: -1000,
          yPos: -1000
        });
      }
      else {
        document.querySelector('.joyride-tooltip__close').click();
      }
    }
  }

  /**
   * Beacon click event listener
   * @param {Event} e - Click event
   */
  _onBeaconTrigger(e) {
    e.preventDefault();
    this._toggleTooltip(true, this.state.index);
  }

  /**
   * Tooltip click event listener
   * @param {Event} e - Click event
   */
  _onClickTooltip(e) {
    e.preventDefault();
    e.stopPropagation();

    const state = this.state;
    const props = this.props;
    const tooltip = document.querySelector('.joyride-tooltip');
    const el = e.target;
    const type = el.dataset.type;
    let newIndex = state.index + (type === 'back' ? -1 : 1);

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
    }
    else if (type) {
      this._toggleTooltip(
        (props.type === 'continuous' || props.type === 'guided')
        && ['close', 'skip'].indexOf(type) === -1
        && Boolean(props.steps[newIndex])
        , newIndex
        , type);
    }
  }

  /**
   * Toggle Tooltip's visibility
   * @param {Boolean} show - Render the tooltip directly or the beacon
   * @param {Number} [index] - The tour's new index
   * @param {string} [action]
   */
  _toggleTooltip(show, index, action) {
    const newIndex = (index !== undefined ? index : this.state.index);
    const props = this.props;

    this.setState({
      play: props.steps[newIndex] ? this.state.play : false,
      showTooltip: show,
      index: newIndex,
      xPos: -1000,
      yPos: -1000
    }, () => {
      const lastIndex = action === 'back' ? newIndex + 1 : newIndex - 1;

      if (action && typeof props.stepCallback === 'function' && props.steps[lastIndex]) {
        props.stepCallback(props.steps[lastIndex]);
      }

      if (props.steps.length && !props.steps[newIndex]) {
        if (typeof props.completeCallback === 'function') {
          props.completeCallback(props.steps, this.state.skipped);
        }
      }
    });
  }

  /**
   * Position absolute elements next to its target
   */
  _calcPlacement() {
    const state = this.state;
    const props = this.props;
    const step = state.tooltip ? state.tooltip : props.steps[state.index];
    const showTooltip = state.tooltip ? true : state.showTooltip;
    const placement = {
      x: -1000,
      y: -1000
    };
    let component;
    let position;
    let body;
    let target;

    if (step) {
      position = step.position;
      body = document.body.getBoundingClientRect();
      target = document.querySelector(step.selector).getBoundingClientRect();
      component = this._getElementDimensions((showTooltip ? '.joyride-tooltip' : '.joyride-beacon'));

      // Change the step position in the tooltip won't fit in the window
      if (/^left/.test(position) && target.left - (component.width + props.tooltipOffset) < 0) {
        position = 'top';
      }
      else if (/^right/.test(position) && target.left + target.width + (component.width + props.tooltipOffset) > body.width) {
        position = 'bottom';
      }

      // Calculate x position
      if (/^left/.test(position)) {
        placement.x = target.left - (showTooltip ? component.width + props.tooltipOffset : component.width / 2);
      }
      else if (/^right/.test(position)) {
        placement.x = target.left + target.width - (showTooltip ? -props.tooltipOffset : component.width / 2);
      }
      else {
        placement.x = target.left + target.width / 2 - component.width / 2;
      }

      // Calculate y position
      if (/^top/.test(position)) {
        placement.y = (target.top - body.top) - (showTooltip ? component.height + props.tooltipOffset : component.height / 2);
      }
      else if (/^bottom/.test(position)) {
        placement.y = (target.top - body.top) + target.height - (showTooltip ? -props.tooltipOffset : component.height / 2);
      }
      else {
        placement.y = (target.top - body.top) + target.height / 2 - component.height / 2 + (showTooltip ? props.tooltipOffset : 0);
      }

      if (/^bottom|^top/.test(position)) {
        if (/left/.test(position)) {
          placement.x = target.left - (showTooltip ? props.tooltipOffset : component.width / 2);
        }
        else if (/right/.test(position)) {
          placement.x = target.left + target.width - (showTooltip ? component.width - props.tooltipOffset : component.width / 2);
        }
      }

      this.setState({
        xPos: this._preventWindowOverflow(Math.ceil(placement.x), 'x', component.width, component.height),
        yPos: this._preventWindowOverflow(Math.ceil(placement.y), 'y', component.width, component.height),
        position
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
  _preventWindowOverflow(value, axis, elWidth, elHeight) {
    const winWidth = window.innerWidth;
    const docHeight = document.body.offsetHeight;
    let newValue = value;

    if (axis === 'x') {
      if (value + elWidth >= winWidth) {
        newValue = winWidth - elWidth - 15;
      }
      else if (value < 15) {
        newValue = 15;
      }
    }
    else if (axis === 'y') {
      if (value + elHeight >= docHeight) {
        newValue = docHeight - elHeight - 15;
      }
      else if (value < 15) {
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
  _createComponent(update) {
    const state = this.state;
    const props = this.props;
    const currentStep = Object.assign({}, state.tooltip || props.steps[state.index]);
    const buttons = {
      primary: props.locale.close
    };
    const target = currentStep && currentStep.selector ? document.querySelector(currentStep.selector) : null;
    const cssPosition = target ? target.style.position : null;
    const showOverlay = state.tooltip ? false : props.showOverlay;
    let component;

    this._log(`joyride:${(update ? 'sizeComponent' : 'renderComponent')}`, [
      'component:', state.showTooltip || state.tooltip ? 'Tooltip' : 'Beacon',
      'target:', target
    ]);

    if (target) {
      if (state.showTooltip || state.tooltip) {
        currentStep.position = state.position;

        if (!state.tooltip) {
          if (props.type === 'continuous' || props.type === 'guided') {
            buttons.primary = props.locale.last;

            if (props.steps[state.index + 1]) {
              buttons.primary = props.locale.next;

              if (props.showStepsProgress) {
                buttons.primary += ` ${(state.index + 1)}/${props.steps.length}`;
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

        component = React.createElement(Tooltip, {
          animate: state.xPos > -1,
          browser: this._getBrowser(),
          buttons,
          cssPosition,
          showOverlay,
          step: currentStep,
          standalone: Boolean(state.tooltip),
          type: props.type,
          xPos: state.xPos,
          yPos: state.yPos,
          onClick: this._onClickTooltip
        });
      }
      else {
        component = React.createElement(Beacon, {
          cssPosition,
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

  render() {
    const state = this.state;
    const props = this.props;
    const hasStep = Boolean(props.steps[state.index]);
    let component;
    let standaloneTooltip;

    if (state.play && state.xPos < 0 && hasStep) {
      this._log('joyride:render', ['step:', props.steps[state.index]]);
    }
    else if (!state.play && state.tooltip) {
      this._log('joyride:render', ['tooltip:', state.tooltip]);
    }

    if (state.tooltip) {
      standaloneTooltip = this._createComponent();
    }
    else if (state.play && hasStep) {
      component = this._createComponent(state.xPos < 0);
    }

    return (
      <div className="joyride">
        {component}
        {standaloneTooltip}
      </div>
    );
  }
}
