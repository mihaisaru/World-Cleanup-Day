import React, { Component } from 'react';
import { MessageBarManager } from 'react-native-message-bar';
import { NavigationActions } from 'react-navigation';
import {
  BackHandler,
  StatusBar,
  View,
  ScrollView,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { compose } from 'recompose';
import { translate } from 'react-i18next';
import { debounce } from 'lodash';

import { operations as appOps, selectors as appSels } from '../../reducers/app';

import { withNavigationHelpers } from '../../services/Navigation';

import { withCameraActions } from '../../services/Camera';
import ImageService from '../../services/Image';
import { withLoadingScreen } from '../../services/Loading';
import { operations as locationOperations } from '../../reducers/location';
import { Button } from '../../components/Buttons';
import { LocationPicker } from './components/LocationPicker';
import { StatusPicker } from './components/StatusPicker';
import { PhotoPicker } from '../../components/PhotoPicker';
import { Divider } from '../../components/Divider';
import {
  getWidthPercentage,
  getHeightPercentage,
  handleSentryError,
} from '../../shared/helpers';
import { Tags } from '../../components/Tags';
import { AmountPicker, AMOUNT_STATUSES } from '../../components/AmountPicker';
import { CongratsModal } from './components/CongratsModal';
import { AlertModal } from '../../components/AlertModal';
import {
  TRASH_COMPOSITION_TYPE_LIST,
  MARKER_STATUSES,
  AMOUNT_HASH,
} from '../../shared/constants';
import {
  operations as trashpileOperations,
  selectors as trashpileSelectors,
} from '../../reducers/trashpile';
import styles from './styles';

const ALERT_CHECK_IMG = require('./alert_check.png');

const MAX_HASHTAGS_NO = 15;
const GRADIENT_COLORS = ['#FFFFFF', '#F1F1F1'];
const HEIGHT_SIZE15 = getHeightPercentage(15);
const HEIGHT_SIZE20 = getHeightPercentage(20);

class CreateMarker extends Component {
  constructor(props) {
    super(props);

    const { navigation: { state: { params } } } = props;

    const state = {
      photos: [...params.photos],
      temporaryHashtag: '',
      amount: AMOUNT_STATUSES.handful,
      status: MARKER_STATUSES.REGULAR,
      congratsShown: false,
      trashCompositionTypes: TRASH_COMPOSITION_TYPE_LIST.map(
        trashCompositionType => ({
          ...trashCompositionType,
          selected: false,
        }),
      ),
      hashtags: [],
      initialLocation: params.coords,
      editableLocation: params.coords,
      address: {},
      disableCreateTrashpointButton: false,
      locationSetByUser: false,
    };

    this.state = state;

    this.closeValidationButton = {
      text: props.t('label_button_acknowledge'),
      onPress: this.hideValidation,
    };

    this.congratsTimeout = setTimeout(() => {
      if (!this.state.congratsShown) {
        this.setState({ congratsShown: true });
      }
      this.congratsTimeout = undefined;
    }, 4000);

    this.handleBackPress = this.handleBackPress.bind(this);
    this.handleTrashpointCreate = debounce(
      this.handleTrashpointCreate,
      2000,
      {
        leading: true,
        trailing: false,
      },
    );
  }

  async componentWillMount() {
    await this.fetchAddressAsync();

    BackHandler.addEventListener('hardwareBackPress', this.handleBackPress);
  }

  componentWillReceiveProps(nextProps) {
    const { isConnected: wasConnected } = this.props;
    const { isConnected } = nextProps;
    const { address, locationSetByUser } = this.state;
    if (!wasConnected && isConnected && !locationSetByUser &&
      (!address || !address.completeAddress)) {
      this.fetchAddressAsync();
    }
  }

  componentWillUnmount() {
    BackHandler.removeEventListener('hardwareBackPress', this.handleBackPress);
  }

  fetchAddressAsync = async (coords) => {
    const address = await locationOperations.fetchAddress(
      coords || this.state.initialLocation,
    );
    this.setState({ address });
  };

  showValidation = (text) => {
    this.setState({
      validation: true,
      validationText: text,
    });
  };
  hideValidation = () => {
    this.setState({
      validation: false,
    });
  };

  handleBackPress() {
    const { navigation } = this.props;
    navigation.dispatch(NavigationActions.reset({
      index: 0,
      actions: [NavigationActions.navigate({ routeName: 'Tabs' })],
    }));
    return true;
  }

  handleEditLocationPress = () => {
    const { initialLocation, status, address } = this.state;
    this.props.navigation.navigate('EditLocation', {
      status,
      initialLocation,
      address,
      onGoBack: (coords) => {
        this.setState(
          { editableLocation: coords },
          async () => {
            this.setState({ locationSetByUser: true });
            await this.fetchAddressAsync(coords);
          },
        );
      },
    });
  };

  handlePhotoAdd = () => {
    this.props
        .takePhotoAsync({ quality: 0.2, base64: true })
        .then(async (response) => {
          if (!response) {
            return;
          }
          const { cancelled, uri, base64, width, height } = response;

          if (cancelled) {
            return;
          }

          const { photos } = this.state;
          const thumbnailBase64 = await ImageService.getResizedImageBase64({
            uri,
            width,
            height,
          });
          this.setState({
            photos: [
              ...photos,
              { uri, base64, thumbnail: { base64: thumbnailBase64 } },
            ],
          });
        })
        .catch(err => handleSentryError(err));
  };

  handlePhotoDelete = (index) => {
    const { photos } = this.state;
    photos.splice(index, 1);
    this.setState({
      photos,
    });
  };

  handleTrashCompositionTypeSelect = index => () => {
    const selectedTag = this.state.trashCompositionTypes[index];
    this.setState({
      trashCompositionTypes: [
        ...this.state.trashCompositionTypes.slice(0, index),
        { ...selectedTag, selected: !selectedTag.selected },
        ...this.state.trashCompositionTypes.slice(index + 1),
      ],
    });
  };

  handleHashtagDelete = index => () => {
    this.setState({
      hashtags: [
        ...this.state.hashtags.slice(0, index),
        ...this.state.hashtags.slice(index + 1),
      ],
    });
  };

  validate() {
    const { photos, trashCompositionTypes } = this.state;
    if (
      !photos ||
      photos.length === 0 ||
      !trashCompositionTypes.find(type => type.selected)
    ) {
      this.showValidation(this.props.t('label_error_saveTP_pic_and_type'));
      return false;
    }
    return true;
  }

  handleTrashpointCreate = () => {
    const { createMarker, navigation, setErrorMessage, t } = this.props;
    const {
      photos,
      trashCompositionTypes,
      hashtags,
      status = MARKER_STATUSES.REGULAR,
      amount,
      address: { completeAddress = '', streetAddress = '', streetNumber = '' },
    } = this.state;

    if (!this.validate()) {
      return;
    }

    this.setState({ disableCreateTrashpointButton: true }, () => {
      createMarker({
        location: this.state.editableLocation,
        status,
        photos,
        composition: [
          ...trashCompositionTypes
            .filter(type => type.selected)
            .map(type => type.type),
        ],
        hashtags: [...hashtags.map(type => type.label)],
        amount: AMOUNT_STATUSES[amount],
        address: completeAddress,
        name: `${streetAddress} ${streetNumber}`,
      }).then(
        (res) => {
          if (res) {
            if (!res.photoStatus) {
              setErrorMessage(t('label_create_marker_missing_photos'));
            }
            navigation.resetTo('Tabs');
            setTimeout(this.showSuccessAlert);
          }
        },
        () => {},
      );
    });
  };

  showSuccessAlert = () => {
    MessageBarManager.showAlert({
      title: this.props.t('label_alert_createTP_success'),
      alertType: 'success',
      avatar: ALERT_CHECK_IMG,
      duration: 4000,
      viewTopInset: Platform.select({
        android: StatusBar.currentHeight,
        ios: 15,
      }),
      stylesheetSuccess: {
        strokeColor: 'transparent',
        backgroundColor: '#3e8ede',
        width: getWidthPercentage(320),
        height: getHeightPercentage(50),
      },
      titleStyle: {
        color: 'white',
        fontSize: 15,
        fontFamily: 'noto-sans-bold',
      },
    });
  };

  handleStatusChanged = (status) => {
    this.setState({
      status,
    });
  };

  handleAddHahstag = () => {
    const { hashtags, temporaryHashtag } = this.state;

    if (hashtags.length === MAX_HASHTAGS_NO) {
      return;
    }

    let label = temporaryHashtag.replace(/[^0-9a-z]/gi, '');

    if (!label) {
      return;
    }

    label = `#${label}`;

    const hashtagAlreadyExists = hashtags.find(
      hashtag => hashtag.label === label,
    );

    if (hashtagAlreadyExists) {
      this.setState({
        temporaryHashtag: '',
      });
    }

    this.setState({
      hashtags: [...hashtags, { label }],
      temporaryHashtag: '',
    });
  };

  handleChangeHashtagText = (text) => {
    this.setState({ temporaryHashtag: text });
  };

  handleAmountSelect = (amount) => {
    this.setState({
      amount: AMOUNT_STATUSES[amount],
    });
  };

  markCongratsShown = () => {
    this.setState({
      congratsShown: true,
    });
    if (this.congratsTimeout) {
      clearTimeout(this.congratsTimeout);
      this.congratsTimeout = undefined;
    }
  };

  render() {
    const {
      photos,
      trashCompositionTypes,
      status,
      hashtags,
      temporaryHashtag,
      amount = AMOUNT_STATUSES.handful,
      validation = false,
      validationText,
      congratsShown,
      editableLocation,
      address = {},
      disableCreateTrashpointButton,
    } = this.state;
    const addHashtagTextStyle = {};
    if (hashtags.length === MAX_HASHTAGS_NO) {
      addHashtagTextStyle.color = GRADIENT_COLORS[1];
    }
    if (!congratsShown) {
      return <CongratsModal onContinuePress={this.markCongratsShown} />;
    }

    return (
      <KeyboardAvoidingView behavior="position">
        <ScrollView style={{ backgroundColor: '#eeeeee' }}>
          <StatusBar translucent barStyle="default" />

          <AlertModal
            visible={validation}
            title={this.props.t('label_error_saveTP_subtitle')}
            subtitle={validationText}
            buttons={[this.closeValidationButton]}
            onOverlayPress={this.hideValidation}
          />

          <LocationPicker
            onEditLocationPress={this.handleEditLocationPress}
            value={editableLocation}
            address={address}
            status={status}
          />
          <Divider />
          <StatusPicker value={status} onChange={this.handleStatusChanged} />
          <Divider />

          <View>
            <PhotoPicker
              maxPhotos={3}
              photos={photos.map(({ uri }) => uri)}
              onDeletePress={this.handlePhotoDelete}
              onAddPress={this.handlePhotoAdd}
            />
          </View>
          <Divider />
          <View style={{ padding: getWidthPercentage(20) }}>
            <Text style={{ fontFamily: 'noto-sans-bold', fontSize: 16 }}>
              {this.props.t('label_text_createTP_select_amount')}
            </Text>
            <AmountPicker amount={amount} onSelect={this.handleAmountSelect} />
            <View
              style={{
                paddingTop: HEIGHT_SIZE20,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: '#3E8EDE',
                  fontFamily: 'noto-sans-bold',
                  fontSize: 13,
                }}
              >
                {AMOUNT_HASH[AMOUNT_STATUSES[amount]]}
              </Text>
            </View>
          </View>
          <Divider />
          <View style={styles.tagsContainer}>
            <Text style={styles.trashtypesText}>
              {this.props.t('label_text_createTP_select_type')}
            </Text>
            <Tags
              tags={trashCompositionTypes}
              onTagSelect={this.handleTrashCompositionTypeSelect}
            />
            <Text style={[styles.trashtypesText, { marginTop: HEIGHT_SIZE15 }]}>
              {this.props.t('label_text_createTP_add_hashtags')}
            </Text>
            <Tags tags={hashtags} onTagDelete={this.handleHashtagDelete} />
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.hashtagInput}
                placeholderStyle={styles.hashtagInputPlaceholder}
                placeholder={this.props.t(
                  'label_text_createTP_add_hashtags_hint',
                )}
                onChangeText={this.handleChangeHashtagText}
                value={temporaryHashtag}
                underlineColorAndroid="transparent"
                maxLength={25}
                onSubmitEditing={this.handleAddHahstag}
              />
            </View>
          </View>
          <Divider />
          <View style={styles.bottomContainer}>
            <Button
              style={styles.createButton}
              text={this.props.t('label_button_createTP_confirm_create')}
              onPress={this.handleTrashpointCreate}
              disabled={disableCreateTrashpointButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
}

CreateMarker.defaultProps = {
  isConnected: false,
};

CreateMarker.propTypes = {
  t: PropTypes.func.isRequired,
  setErrorMessage: PropTypes.func.isRequired,
  isConnected: PropTypes.bool,
  navigation: PropTypes.object.isRequired,
  createMarker: PropTypes.func.isRequired,
  takePhotoAsync: PropTypes.func.isRequired,
};

const mapDispatch = {
  createMarker: trashpileOperations.createMarker,
  setErrorMessage: appOps.setErrorMessage,
};

const mapStateToProps = state => ({
  isConnected: appSels.isConnected(state),
  loading: trashpileSelectors.isLoading(state),
});

export default compose(
  connect(mapStateToProps, mapDispatch),
  withNavigationHelpers(),
  withLoadingScreen(props => props.loading, { compact: false }),
  withCameraActions(),
  translate(),
)(CreateMarker);
