import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import {
  actions as appActions,
  selectors as appSelectors,
} from './reducers/app';
import { actions as trashpileActions } from './reducers/trashpile';
import {
  selectors as userSelectors,
  actions as userActions,
} from './reducers/user';
import { persistStoreAsync } from './config/persist';
import store from './config/store';
import { Loader } from './components/Spinner';
import { ApiService } from './services/';

import { AuthModal } from './components/AuthModal';
import { LockedModal } from './components/LockedModal';

import Router from './routes/index';

import './normalizer.css';
import './App.css';


class App extends Component {
  constructor() {
    super();
    this.state = {
      appLoaded: false,
    };
  }

  async componentWillMount() {
    Promise.all([
      await this.props.fetchDatasets(),
      await persistStoreAsync({
        store,
        localStorage,
      }),
    ]).then(() => {
      const token = userSelectors.getUserToken(store.getState());
      if (token) {
        ApiService.setAuthToken(token);
        this.props.fetchProfile();
      }
      this.setState({ appLoaded: true });
    });
  }
  closeModal = () => {
    this.props.hideModal();
  };
  handleLockedModalClose = () => {
    this.props.toggleLockedModal(false);
  }

  render() {
    const { modalIsOpen, lockedModalIsOpen } = this.props;

    if (!this.state.appLoaded) {
      return <Loader />;
    }

    return (
      <div className="App" role="presentation" onClick={this.props.hidePopover}>
        <Router />
        <AuthModal isOpen={modalIsOpen} onClick={this.closeModal} />
        <LockedModal
          isOpen={lockedModalIsOpen}
          onClick={this.handleLockedModalClose}
        />
      </div>
    );
  }
}

App.propTypes = {
  fetchProfile: PropTypes.func.isRequired,
  modalIsOpen: PropTypes.bool.isRequired,
  lockedModalIsOpen: PropTypes.bool.isRequired,
  hideModal: PropTypes.func.isRequired,
  toggleLockedModal: PropTypes.func.isRequired,
  hidePopover: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  isAuthenticated: !!userSelectors.getUserToken(state),
  modalIsOpen: appSelectors.getShowModal(state),
  lockedModalIsOpen: appSelectors.getShowLockedModal(state),
});

const mapDispatchToProps = {
  fetchDatasets: appActions.fetchDatasets,
  hidePopover: appActions.hideLoginPopover,
  fetchAllMarkers: trashpileActions.fetchAllMarkers,
  hideModal: appActions.hideModal,
  showModal: appActions.showModal,
  fetchProfile: userActions.fetchProfile,
  toggleLockedModal: appActions.toggleLockedModal,
};

export default connect(mapStateToProps, mapDispatchToProps)(App);
