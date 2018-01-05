import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-modal';

import { SHARED_MODAL_STYLES } from '../../shared/constants';
import closeButton from '../../assets/closeButton.png';

import './AlertModal.css';

const AlertModal = ({ message, isOpen, onClick }) => (
  <Modal isOpen={isOpen} style={SHARED_MODAL_STYLES} contentLabel="">
    <button className="Shared-modal-close-button" onClick={onClick}>
      <img src={closeButton} alt="" />
    </button>
    <div>
      <div className="NoAuthorization-modal">
        <span className="NoAuthorization-modal-title">
          {message}
        </span>
      </div>
    </div>
  </Modal>
);

AlertModal.defaultProps = {
  message: '',
};

AlertModal.propTypes = {
  message: PropTypes.string,
  isOpen: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default AlertModal;
