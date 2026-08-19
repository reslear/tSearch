import {inject, observer} from "mobx-react";
import React from "react";
import PropTypes from "prop-types";

@inject('rootStore')
@observer
class WhenReady extends React.Component {
  static propTypes = {
    rootStore: PropTypes.object,
  };

  constructor(props) {
    super(props);

    if (this.rootStore.options.state === 'idle') {
      this.rootStore.options.fetchOptions();
    }
  }

  /**@return RootStore*/
  get rootStore() {
    return this.props.rootStore;
  }

  componentDidMount() {
    this.rootStore.checkForUpdate();
  }

  render() {
    return null;
  }
}

export default WhenReady;
