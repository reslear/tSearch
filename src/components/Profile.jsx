import React from "react";
import {inject, observer} from "mobx-react";
import PropTypes from "prop-types";
import ProfileTracker from "./ProfileTracker";
import {ResizableBox} from "react-resizable";


@inject('rootStore')
@observer
class Profile extends React.Component {
  static propTypes = {
    id: PropTypes.string,
    rootStore: PropTypes.object,
    profileStore: PropTypes.object,
  };

  constructor(props) {
    super(props);

    let trackerListHeight = this.optionsStore.options.trackerListHeight;
    if (trackerListHeight < 56) {
      trackerListHeight = 56;
    }
    this.state = {
      trackerListHeight: trackerListHeight,
    };

    if (this.trackersStore.state === 'idle') {
      this.trackersStore.fetchTrackers();
    }
  }

  /**@return RootStore*/
  get rootStore() {
    return this.props.rootStore;
  }

  /**@return OptionsStore*/
  get optionsStore() {
    return this.rootStore.options;
  }

  get trackersStore() {
    return this.rootStore.trackers;
  }

  get profileStore() {
    return this.props.profileStore;
  }

  /**@return SearchStore*/
  get searchStore() {
    const searches = this.rootStore.searches;
    const len = searches.length;
    if (len) {
      return searches[len - 1];
    }
    return null;
  }

  getTrackerListOrder = (profileTracker) => {
    const searchStore = this.searchStore;
    const tracker = profileTracker.tracker;
    if (!searchStore) {
      return {order: 2, count: 0};
    }

    if (!tracker) {
      return {order: 2, count: 0};
    }

    const trackerSearchStore = searchStore.trackerSearch.get(profileTracker.id);
    if (trackerSearchStore && trackerSearchStore.authRequired) {
      return {order: 1, count: 0};
    }

    if (trackerSearchStore && !trackerSearchStore.authRequired && trackerSearchStore.state === 'error') {
      return {order: 3, count: -1};
    }

    const isTrackerDisabled = this.rootStore.options.options.trackerHealth &&
      this.rootStore.options.options.trackerHealth.isTrackerDisabled(profileTracker.id);
    if (isTrackerDisabled) {
      return {order: 3, count: -1};
    }

    if (trackerSearchStore) {
      const count = searchStore.getResultCountByTrackerId(profileTracker.id);
      if (count > 0) {
        return {order: 0, count};
      }
    }

    return {order: 2, count: 0};
  };

  handleResizeStop = (e, {size: {height}}) => {
    this.state.trackerListHeight = height;
    this.optionsStore.options.setValue('trackerListHeight', height);
    this.optionsStore.save();
  };

  render() {
    if (this.trackersStore.state !== 'done') {
      return (`Loading trackers: ${this.trackersStore.state}`);
    }

    const trackers = this.profileStore.trackers.slice(0).sort((a, b) => {
      const aMeta = this.getTrackerListOrder(a);
      const bMeta = this.getTrackerListOrder(b);

      if (aMeta.order !== bMeta.order) {
        return aMeta.order - bMeta.order;
      }
      return aMeta.count - bMeta.count;
    }).map((profileTracker) => (
      <ProfileTracker key={profileTracker.id} profileTrackerStore={profileTracker}/>
    ));

    return (
      <ResizableBox onResizeStop={this.handleResizeStop} width={Infinity} height={this.state.trackerListHeight} axis={'y'} minConstraints={[0, 56]}>
        <div className="tracker__list">
          {trackers}
        </div>
      </ResizableBox>
    );
  }
}

export default Profile;
