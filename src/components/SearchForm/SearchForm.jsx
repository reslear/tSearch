import './searchForm.less';
import React from 'react';
import Autosuggest from 'react-autosuggest';
import {inject, observer} from 'mobx-react';
import getLogger from "../../tools/getLogger";
import PropTypes from 'prop-types';

const debug = getLogger('SearchForm');

const sanitizeAutosuggest = (Component) => {
  if (!Component?.prototype || !Object.prototype.hasOwnProperty.call(Component.prototype, 'componentWillReceiveProps')) {
    return Component;
  }

  if (!Object.prototype.hasOwnProperty.call(Component.prototype, 'UNSAFE_componentWillReceiveProps')) {
    Component.prototype.UNSAFE_componentWillReceiveProps = Component.prototype.componentWillReceiveProps;
  }

  delete Component.prototype.componentWillReceiveProps;
  return Component;
};

const PatchedAutosuggest = sanitizeAutosuggest(Autosuggest);

@inject('rootStore')
@observer
class SearchForm extends React.Component {
  static propTypes = {
    rootStore: PropTypes.object,
    onSubmit: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      shouldRenderSuggestions: false,
      visibleRecentCount: 0,
    };

    this.recentContainerRef = React.createRef();
    this.measureCanvas = null;
    this.measureTimer = null;
  }

  getRecentQueries = (props = this.props) => {
    const historyStore = props.rootStore.history;
    return historyStore.state === 'done'
      ? historyStore.getHistorySortByTime().slice(0, 8).map(item => item.query).filter(Boolean)
      : [];
  }

  componentDidMount() {
    if (this.props.rootStore.history.state === 'idle') {
      this.props.rootStore.history.fetchHistory();
    }
    window.addEventListener('resize', this.scheduleVisibleRecentUpdate);
    this.scheduleVisibleRecentUpdate();
  }

  componentDidUpdate(prevProps) {
    const prevRecentCount = this.getRecentQueries(prevProps).length;
    const currentRecentCount = this.getRecentQueries().length;
    const prevHistoryState = prevProps.rootStore.history.state;
    const currentHistoryState = this.props.rootStore.history.state;
    if (prevRecentCount !== currentRecentCount || prevHistoryState !== currentHistoryState) {
      this.updateVisibleRecentQueries();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.scheduleVisibleRecentUpdate);
    if (this.measureTimer) {
      clearTimeout(this.measureTimer);
      this.measureTimer = null;
    }
  }

  updateVisibleRecentQueries = () => {
    if (this.measureTimer) {
      clearTimeout(this.measureTimer);
      this.measureTimer = null;
    }

    const recentQueries = this.getRecentQueries();
    const node = this.recentContainerRef.current;
    if (!node) {
      this.setState({visibleRecentCount: 0});
      return;
    }

    const maxWidth = node.clientWidth;
    if (!maxWidth || !recentQueries.length) {
      if (this.state.visibleRecentCount !== 0) {
        this.setState({visibleRecentCount: 0});
      }
      return;
    }

    if (!this.measureCanvas) {
      this.measureCanvas = document.createElement('canvas');
    }

    const style = getComputedStyle(node);
    const font = style.font;
    const ctx = this.measureCanvas.getContext('2d');
    if (!ctx) {
      if (this.state.visibleRecentCount !== recentQueries.length) {
        this.setState({visibleRecentCount: recentQueries.length});
      }
      return;
    }
    ctx.font = font;

    const separatorWidth = ctx.measureText('•').width + 12;
    let usedWidth = 0;
    let visibleCount = 0;

    recentQueries.some((query) => {
      const width = ctx.measureText(query).width;
      const itemWidth = width + (visibleCount > 0 ? separatorWidth : 0);
      if (usedWidth + itemWidth <= maxWidth) {
        usedWidth += itemWidth;
        visibleCount++;
        return false;
      }
      return true;
    });

    if (this.state.visibleRecentCount !== visibleCount) {
      this.setState({visibleRecentCount: visibleCount});
    }
  }

  scheduleVisibleRecentUpdate = () => {
    if (this.measureTimer) {
      return;
    }
    this.measureTimer = setTimeout(() => {
      this.measureTimer = null;
      this.updateVisibleRecentQueries();
    }, 0);
  };

  enableRenderSuggestions = () => {
    if (!this.state.shouldRenderSuggestions) {
      this.setState({
        shouldRenderSuggestions: true
      });
    }
  };

  handleChange = (e, {newValue}) => {
    const searchForm = this.props.rootStore.searchForm;
    this.enableRenderSuggestions();
    searchForm.setQuery(newValue);
  };

  shouldRenderSuggestions = () => {
    return this.state.shouldRenderSuggestions;
  };

  handleSubmit = (e) => {
    const searchForm = this.props.rootStore.searchForm;
    e.preventDefault();
    this.props.onSubmit(searchForm.query);
  };

  handleFetchSuggestions = ({value}) => {
    this.props.rootStore.searchForm.fetchSuggestions(value);
  };

  handleClearSuggestions = () => {
    this.props.rootStore.searchForm.clearSuggestions();
  };

  renderSuggestion = (suggestion) => {
    return (
      <span>{suggestion}</span>
    );
  };

  handleRecentClick = (query) => (e) => {
    e.preventDefault();
    const searchForm = this.props.rootStore.searchForm;
    searchForm.setQuery(query);
    this.props.onSubmit(query);
  };

  render() {
    const searchForm = this.props.rootStore.searchForm;
    const recentQueries = this.getRecentQueries().slice(0, this.state.visibleRecentCount);
    const inputProps = {
      type: 'search',
      placeholder: chrome.i18n.getMessage('searchPlaceholder'),
      value: searchForm.query,
      onChange: this.handleChange,
      autoFocus: true
    };

    if (!this.state.shouldRenderSuggestions) {
      inputProps.onClick = this.enableRenderSuggestions;
      inputProps.onBlur = this.enableRenderSuggestions;
      inputProps.onKeyDown = this.enableRenderSuggestions;
      inputProps.onMouseDown = this.enableRenderSuggestions;
    }

    return (
      <div className="search-from">
        <form onSubmit={this.handleSubmit}>
          <PatchedAutosuggest
            inputProps={inputProps}
            theme={{
              input: 'input',
              suggestionsContainer: 'suggestions-container',
              suggestionsList: 'suggestions-list',
              suggestion: 'suggestion',
              suggestionHighlighted: 'suggestion--highlighted'
            }}
            suggestions={searchForm.getSuggestions()}
            onSuggestionsFetchRequested={this.handleFetchSuggestions}
            onSuggestionsClearRequested={this.handleClearSuggestions}
            shouldRenderSuggestions={this.shouldRenderSuggestions}
            getSuggestionValue={suggestion => suggestion}
            renderSuggestion={this.renderSuggestion}
          />
          <button type="submit" className="submit">{chrome.i18n.getMessage('search')}</button>
        </form>
        <div className="search-from__recent" ref={this.recentContainerRef}>
          {recentQueries.map((query, index) => (
            <React.Fragment key={`${query}-${index}`}>
              {index > 0 ? <span className="search-from__recent-separator">•</span> : null}
              <a className="search-from__recent-item" href="#" onClick={this.handleRecentClick(query)}>{query}</a>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
}

export default SearchForm;
