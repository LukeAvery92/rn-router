'use strict';

var React = require('react-native');
var EventEmitter = require('event-emitter');

var {
  View, Navigator, Children, PropTypes, createElement, createClass,
  InteractionManager
} = React;

var Wrapper = require('./Wrapper');
var Transitions = require('./Transitions');

var Router = React.createClass({

  displayName: 'Router',

  eventEmitter: null,

  childContextTypes: {
    platform: PropTypes.string,
    route: PropTypes.object,
    lastRoute: PropTypes.object,
    transitionTo: PropTypes.func,
    transitionBack: PropTypes.func,
    events: PropTypes.object,
  },

  propTypes: {
    platform: PropTypes.string,
    defaultTransition: PropTypes.any.isRequired,
  },

  getDefaultProps() {
    return {
      defaultTransition: Transitions.None
    };
  },

  getInitialState() {
    return {
      route: this.getInitalRoute(),
    };
  },

  getChildContext() {
    return {
      platform: this.props.platform || 'undefined',
      route: this.state.route,
      lastRoute: this._getLastRoute(),
      transitionTo: this.transitionTo,
      transitionBack: this.transitionBack,
      events: this.eventEmitter,
    };
  },

  componentWillMount() {
    this.eventEmitter = EventEmitter({});
  },

  componentDidMount() {
    this.refs.navigator.navigationContext.addListener('willfocus', this.emitWillFocus);
    this.refs.navigator.navigationContext.addListener('didfocus', this.emitDidFocus);
  },

  _getLastRoute() {
    if (typeof this.refs.navigator === 'undefined') { return null; }
    let routes = this.refs.navigator.getCurrentRoutes();
    if (routes.length - 2 < 0) { return null; }
    return routes[routes.length - 2];
  },

  clone(array) {
    return JSON.parse(JSON.stringify(array));
  },

  cloneProps(props) {
    let clone = {
      name: props.name || '',
      component: props.component,
      children: props.children,
      parent: this.clonePropsBase(props.parent)
    };
    return clone;
  },

  clonePropsBase(props) {
    if (typeof props === 'undefined') { return props; }
    let clone = {
      name: props.name || '',
      component: props.component,
    };
    return clone;
  },

  getRouteComponent(name, children, directParent, routeProps) {
    routeProps = typeof routeProps === 'undefined' ? {} : routeProps;
    children = typeof children === 'undefined' ? this.props.children : children;

    let indexRoute = (name === '' || name === '/' || name === 'root');
    name = this.clone(name).split('/');
    let currentName = name.shift();

    var routeComponent = {};
    Children.forEach(children, (child) => {
      if ((indexRoute && child.type.displayName === 'IndexRoute') || child.props.name === currentName) {
        routeComponent = this.cloneProps(child.props);
      } else if (child.props.name.indexOf(':') === 0) {
        routeProps[child.props.name.replace(':', '')] = currentName;
        routeComponent = this.cloneProps(child.props);
      }
    });

    if (typeof directParent !== 'undefined') {
      routeComponent.parent = directParent;
    }
    routeComponent.routeProps = routeProps;

    if (name.length === 0 && Children.count(routeComponent.children) > 0) {
      routeComponent = this.getRouteComponent('', routeComponent.children, routeComponent, routeProps);
    }

    return name.length > 0 ?
      this.getRouteComponent(name.join('/'), routeComponent.children, routeComponent, routeProps)
      :
      routeComponent;
  },

  getInitalRoute() {
    var componentProps = this.getRouteComponent('');
    let component = componentProps.component;

    if (typeof componentProps.parent !== 'undefined' && typeof componentProps.parent.component !== 'undefined') {
      component = this._getWrapper(componentProps, createElement(component));
    }

    return {
      name: 'root',
      routeName: componentProps.name,
      component: component,
      props: {},
      sceneConfig: this.props.defaultTransition
    };
  },

  _getWrapper(componentProps, child) {
    let router = this;
    return createClass({
      displayName: 'RouteWrapper',
      render: function() {
        return router._getWrapperComponent(componentProps, child);
      }
    });
  },

  _getWrapperComponent(componentProps, child) {
    let parent = componentProps.parent;
    let wrapper = createElement(Wrapper, { parent: parent.component, child });

    if (typeof parent.parent !== 'undefined' && typeof parent.parent.component !== 'undefined') {
      return this._getWrapperComponent(parent, wrapper);
    }
    return wrapper;
  },

  _buildRoute(name, props, sceneConfig) {
    props = typeof props === 'undefined' ? {} : props;
    props = typeof props === 'object' ? props : {};
    sceneConfig = typeof sceneConfig === 'undefined' ? this.props.defaultTransition : sceneConfig;

    let componentProps = this.getRouteComponent(name);
    let component = componentProps.component;
    props = Object.assign({}, props, componentProps.routeProps);
    if (typeof componentProps.parent !== 'undefined' && typeof componentProps.parent.component !== 'undefined') {
      component = this._getWrapper(componentProps, createElement(componentProps.component, props));
    }

    return {
      name: name,
      routeName: componentProps.name,
      component: component,
      props: props,
      sceneConfig: sceneConfig
    };
  },

  transitionTo(name, props, sceneConfig) {
    var navigator = this.refs.navigator;
    let route = this._buildRoute(name, props, sceneConfig);

    if (typeof route.component !== 'undefined') {
      InteractionManager.runAfterInteractions(() => {
        navigator.push(route);
      });
    }
  },

  transitionBack() {
    let lastRoute = this._getLastRoute();
    if (lastRoute !== null) {
      let route = this._buildRoute(lastRoute.name, lastRoute.props, lastRoute.sceneConfig);

      if (typeof route.component !== 'undefined') {
        this.refs.navigator.replacePrevious(route);
        InteractionManager.runAfterInteractions(() => {
          this.refs.navigator.pop();
        });
      }
    }
  },

  renderScene(route, navigator) {
    return createElement(route.component, route.props);
  },

  configureScene(route) {
    if (this.state.route !== route) {
      this.setState({ route: route });
    }
    return route.sceneConfig;
  },

  emitWillFocus(route) {
    this.eventEmitter.emit('routeWillFocus', { route: route });
  },

  emitDidFocus(route) {
    this.eventEmitter.emit('routeDidFocus', { route: route });
  },

  render() {
    var navProps = {
      initialRoute: this.state.route,
      configureScene: this.configureScene,
      renderScene: this.renderScene,
    };

    return (
      <Navigator
        ref="navigator"
        {...navProps}
      />
    );
  }
});

module.exports = Router;
