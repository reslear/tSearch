import {inject, observer} from "mobx-react";
import React from "react";
import getTrackerIconClassName from "../tools/getTrackerIconClassName";
import blankSvg from "../assets/img/blank.svg";
import PropTypes from "prop-types";

@inject('rootStore')
@observer
class ProfileTracker extends React.Component {
  static propTypes = {
    profileTrackerStore: PropTypes.object.isRequired,
  };

  /**@return ProfileTrackerStore*/
  get profileTrackerStore() {
    return this.props.profileTrackerStore;
  }

  /**@return RootStore*/
  get rootStore() {
    return this.props.rootStore;
  }

  /**@return SearchStore*/
  get searchStore() {
    const searches = this.rootStore.searches;
    const len = searches.length;
    if (len) {
      return searches[len - 1];
    }
  }

  get trackerSearchStore() {
    const searchStore = this.searchStore;
    if (searchStore) {
      return searchStore.trackerSearch.get(this.profileTrackerStore.id);
    }
  }

  /**@return TrackerStore*/
  get trackerStore() {
    return this.profileTrackerStore.tracker;
  }

  handleHide = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.rootStore.profiles.removeTrackerFromActiveProfile(this.profileTrackerStore.id);
  };

  render() {
    if (!this.trackerStore) {
      const name = this.profileTrackerStore.meta.name || 'Not found';
      const disabledReason = this.rootStore.options.options.trackerHealth &&
        this.rootStore.options.options.trackerHealth.getTrackerDisableReason(this.profileTrackerStore.id);
      const iconTitle = this.trackerSearchStore && this.trackerSearchStore.errorReason || disabledReason || 'Not found';
      const isError = Boolean(disabledReason);
      const classList = ['tracker'];
      if (isError) {
        classList.push('tracker-error');
      }
      const openBtn = this.profileTrackerStore.meta.trackerURL ? (
        <a className="tracker__open" target="_blank" href={this.profileTrackerStore.meta.trackerURL}
           title={chrome.i18n.getMessage('openInNewTab')}/>
      ) : null;
      const hideBtn = (
        <a onClick={this.handleHide} className="tracker__hide button-remove" href="#hide-tracker"
           title={chrome.i18n.getMessage('delete')}/>
      );

      return (
        <div className={classList.join(' ')}>
          <div className="tracker__icon tracker__icon-error" title={iconTitle}/>
          <span className="tracker__name">{name}</span>
          {openBtn}
          {hideBtn}
        </div>
      );
    }

    return (
      <Tracker id={this.trackerStore.id} profileTrackerStore={this.profileTrackerStore}
               trackerStore={this.trackerStore} onHide={this.handleHide}/>
    );
  }
}

@inject('rootStore')
@observer
class Tracker extends React.Component {
  static propTypes = {
    rootStore: PropTypes.object,
    trackerStore: PropTypes.object.isRequired,
    profileTrackerStore: PropTypes.object.isRequired,
    onHide: PropTypes.func,
  };

  /**@return RootStore*/
  get rootStore() {
    return this.props.rootStore;
  }

  /**@return ProfileTrackerStore*/
  get profileTrackerStore() {
    return this.props.profileTrackerStore;
  }

  /**@return TrackerStore*/
  get trackerStore() {
    return this.props.trackerStore;
  }

  /**@return SearchStore*/
  get searchStore() {
    const searches = this.rootStore.searches;
    const len = searches.length;
    if (len) {
      return searches[len - 1];
    }
  }

  /**@return TrackerSearchStore*/
  get trackerSearchStore() {
    const searchStore = this.searchStore;
    if (searchStore) {
      return searchStore.trackerSearch.get(this.trackerStore.id);
    }
  }

  get isTrackerDisabled() {
    const options = this.rootStore.options.options;
    return options && options.trackerHealth && options.trackerHealth.isTrackerDisabled(this.trackerStore.id);
  }

  get trackerDisableReason() {
    const options = this.rootStore.options.options;
    if (options && options.trackerHealth) {
      return options.trackerHealth.getTrackerDisableReason(this.trackerStore.id);
    }
  }

  componentDidMount() {
    this.trackerStore.attach();
    this.trackerStore.setProfileOptions(this.profileTrackerStore.options);
  }

  componentWillUnmount() {
    this.trackerStore.deattach();
  }

  handleClick = (e) => {
    e.preventDefault();

    const wasSelected = this.rootStore.profiles.isSelectedTracker(this.trackerStore.id);
    this.rootStore.profiles.clearSelectedTrackers();
    if (!wasSelected) {
      this.rootStore.profiles.addSelectedTracker(this.trackerStore.id);
    }
  };

  handleHide = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (this.props.onHide) {
      this.props.onHide(e);
      return;
    }
    this.rootStore.profiles.removeTrackerFromActiveProfile(this.trackerStore.id);
  };

  render() {
    const tracker = this.trackerStore;

    const iconClassList = ['tracker__icon'];

    iconClassList.push(getTrackerIconClassName(tracker.id));

    const trackerSearchStore = this.trackerSearchStore;
    if (this.isTrackerDisabled) {
      iconClassList.push('tracker__icon-error');
    }
    if (trackerSearchStore) {
      if (trackerSearchStore.state === 'pending') {
        iconClassList.push('tracker__icon-loading');
      } else
      if (!trackerSearchStore.authRequired && trackerSearchStore.state === 'error') {
        iconClassList.push('tracker__icon-error');
      }
    }

    const errorTitle = trackerSearchStore && trackerSearchStore.errorReason || this.trackerDisableReason;

    let icon = null;
    if (tracker.meta.trackerURL) {
      iconClassList.push('tracker__link');
      icon = (
        <a className={iconClassList.join(' ')} target="_blank" href={tracker.meta.trackerURL} title={errorTitle}/>
      );
    } else {
      icon = (
        <div className={iconClassList.join(' ')} title={errorTitle}/>
      );
    }

    let searchState = null;
    const isError = this.isTrackerDisabled || (trackerSearchStore && !trackerSearchStore.authRequired && trackerSearchStore.state === 'error');

    if (trackerSearchStore) {
      if (trackerSearchStore.authRequired) {
        searchState = (
          <a className="tracker__login" target="_blank" href={trackerSearchStore.authRequired.url}
             title={chrome.i18n.getMessage('login')}/>
        );
      } else
      if (trackerSearchStore.state === 'error') {
        searchState = (
          <div className="tracker__counter tracker__counter-error" title={errorTitle}>{'!'}</div>
        );
      } else {
        const count = this.searchStore.getResultCountByTrackerId(tracker.id);
        const visibleCount = this.searchStore.getVisibleResultCountByTrackerId(tracker.id);

        let text = '';
        if (count === visibleCount) {
          text = count;
        } else {
          text = visibleCount + '/' + count;
        }
        searchState = (
          <div className="tracker__counter">{text}</div>
        )
      }
    } else
    if (this.isTrackerDisabled) {
      searchState = (
        <div className="tracker__counter tracker__counter-error" title={errorTitle}>{'!'}</div>
      );
    }

    const iconUrl = tracker.getIconUrl() || blankSvg;

    const classList = ['tracker'];
    if (isError) {
      classList.push('tracker-error');
    }
    if (this.rootStore.profiles.isSelectedTracker(tracker.id)) {
      classList.push('tracker-selected');
    }

    const openBtn = tracker.meta.trackerURL ? (
      <a className="tracker__open" target="_blank" href={tracker.meta.trackerURL}
         title={chrome.i18n.getMessage('openInNewTab')}/>
    ) : null;
    const hideBtn = (
      <a onClick={this.handleHide} className="tracker__hide button-remove" href="#hide-tracker"
         title={chrome.i18n.getMessage('delete')}/>
    );

    return (
      <div className={classList.join(' ')}>
        {icon}
        <a className="tracker__name" href={'#' + tracker.id}
           onClick={this.handleClick}>{tracker.meta.name}</a>
        {searchState}
        {openBtn}
        {hideBtn}
        <style>{`.${getTrackerIconClassName(tracker.id)}{background-image:url(${iconUrl})`}</style>
      </div>
    );
  }
}

export default ProfileTracker;
