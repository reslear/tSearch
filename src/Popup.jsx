import React from 'react';
import ReactDOM from 'react-dom';
import './assets/css/popup.less';
import './assets/css/build-meta.less';
import SearchForm from './components/SearchForm/SearchForm';
import RootStore from "./stores/RootStore";
import {Provider} from "mobx-react";
import errorTracker from "./tools/errorTracker";
import BuildMeta from './components/BuildMeta';
import qs from "./tools/query-string";
import './shims/setImmediate';

errorTracker.bindExceptions();
const rootStore = window.rootStore = RootStore.create();

class Popup extends React.Component {
  handleSubmit = (query) => {
    let url = 'index.html';
    if (query) {
      url += '#/search?' + qs.stringify({
        query: query
      });
    }
    chrome.tabs.create({url: url});
  };

  render() {
    return (
      <div className="search">
        <SearchForm onSubmit={this.handleSubmit}/>
        <BuildMeta/>
      </div>
    );
  }
}

ReactDOM.render(
  <Provider rootStore={rootStore}>
    <Popup/>
  </Provider>,
  document.getElementById('root')
);
