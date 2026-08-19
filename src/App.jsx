import React from 'react';
import ReactDOM from 'react-dom';
import RootStore from "./stores/RootStore";
import {HashRouter, Route, Switch} from 'react-router-dom';
import {Provider} from 'mobx-react';
import routes from "./routes";
import '../src/assets/css/index.less';
import './assets/css/build-meta.less';
import WhenReady from "./components/WhenReady";
import BuildMeta from './components/BuildMeta';
import './shims/setImmediate';

const rootStore = window.rootStore = RootStore.create();

ReactDOM.render(
  <HashRouter>
    <Provider rootStore={rootStore}>
      <>
        <Switch>
          {routes.map(route => {
            return (
              <Route key={`route-${route.path}`} {...route}/>
            );
          })}
        </Switch>
        <BuildMeta/>
        <WhenReady/>
      </>
    </Provider>
  </HashRouter>,
  document.getElementById('root')
);
