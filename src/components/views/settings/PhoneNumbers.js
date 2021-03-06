/*
Copyright 2019 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import PropTypes from 'prop-types';
import {_t} from "../../../languageHandler";
import MatrixClientPeg from "../../../MatrixClientPeg";
import Field from "../elements/Field";
import AccessibleButton from "../elements/AccessibleButton";
import AddThreepid from "../../../AddThreepid";
import CountryDropdown from "../auth/CountryDropdown";
const sdk = require('../../../index');
const Modal = require("../../../Modal");

/*
TODO: Improve the UX for everything in here.
This is a copy/paste of EmailAddresses, mostly.
 */

// TODO: Combine EmailAddresses and PhoneNumbers to be 3pid agnostic

export class ExistingPhoneNumber extends React.Component {
    static propTypes = {
        msisdn: PropTypes.object.isRequired,
        onRemoved: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        this.state = {
            verifyRemove: false,
        };
    }

    _onRemove = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({verifyRemove: true});
    };

    _onDontRemove = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({verifyRemove: false});
    };

    _onActuallyRemove = (e) => {
        e.stopPropagation();
        e.preventDefault();

        MatrixClientPeg.get().deleteThreePid(this.props.msisdn.medium, this.props.msisdn.address).then(() => {
            return this.props.onRemoved(this.props.msisdn);
        }).catch((err) => {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            console.error("Unable to remove contact information: " + err);
            Modal.createTrackedDialog('Remove 3pid failed', '', ErrorDialog, {
                title: _t("Unable to remove contact information"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });
    };

    render() {
        if (this.state.verifyRemove) {
            return (
                <div className="mx_ExistingPhoneNumber">
                    <span className="mx_ExistingPhoneNumber_promptText">
                        {_t("Are you sure?")}
                    </span>
                    <AccessibleButton onClick={this._onActuallyRemove} kind="primary_sm"
                                      className="mx_ExistingPhoneNumber_confirmBtn">
                        {_t("Yes")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this._onDontRemove} kind="danger_sm"
                                      className="mx_ExistingPhoneNumber_confirmBtn">
                        {_t("No")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <div className="mx_ExistingPhoneNumber">
                <img src={require("../../../../res/img/feather-icons/cancel.svg")} width={14} height={14}
                     onClick={this._onRemove} className="mx_ExistingPhoneNumber_delete" alt={_t("Remove")} />
                <span className="mx_ExistingPhoneNumber_address">+{this.props.msisdn.address}</span>
            </div>
        );
    }
}

export default class PhoneNumbers extends React.Component {
    constructor() {
        super();

        this.state = {
            msisdns: [],
            verifying: false,
            verifyError: false,
            verifyMsisdn: "",
            addTask: null,
            continueDisabled: false,
            phoneCountry: "",
        };
    }

    componentWillMount(): void {
        const client = MatrixClientPeg.get();

        client.getThreePids().then((addresses) => {
            this.setState({msisdns: addresses.threepids.filter((a) => a.medium === 'msisdn')});
        });
    }

    _onRemoved = (address) => {
        this.setState({msisdns: this.state.msisdns.filter((e) => e !== address)});
    };

    _onAddClick = (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.refs.newPhoneNumber) return;

        const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
        const phoneNumber = this.refs.newPhoneNumber.value;
        const phoneCountry = this.state.phoneCountry;

        const task = new AddThreepid();
        this.setState({verifying: true, continueDisabled: true, addTask: task});

        task.addMsisdn(phoneCountry, phoneNumber, true).then((response) => {
            this.setState({continueDisabled: false, verifyMsisdn: response.msisdn});
        }).catch((err) => {
            console.error("Unable to add phone number " + phoneNumber + " " + err);
            this.setState({verifying: false, continueDisabled: false, addTask: null});
            Modal.createTrackedDialog('Add Phone Number Error', '', ErrorDialog, {
                title: _t("Error"),
                description: ((err && err.message) ? err.message : _t("Operation failed")),
            });
        });
    };

    _onContinueClick = (e) => {
        e.stopPropagation();
        e.preventDefault();

        this.setState({continueDisabled: true});
        const token = this.refs.newPhoneNumberCode.value;
        this.state.addTask.haveMsisdnToken(token).then(() => {
            this.setState({
                msisdns: [...this.state.msisdns, {address: this.state.verifyMsisdn, medium: "msisdn"}],
                addTask: null,
                continueDisabled: false,
                verifying: false,
                verifyMsisdn: "",
                verifyError: null,
            });
            this.refs.newPhoneNumber.value = "";
        }).catch((err) => {
            this.setState({continueDisabled: false});
            if (err.errcode !== 'M_THREEPID_AUTH_FAILED') {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                console.error("Unable to verify phone number: " + err);
                Modal.createTrackedDialog('Unable to verify phone number', '', ErrorDialog, {
                    title: _t("Unable to verify phone number."),
                    description: ((err && err.message) ? err.message : _t("Operation failed")),
                });
            } else {
                this.setState({verifyError: _t("Incorrect verification code")});
            }
        });
    };

    _onCountryChanged = (e) => {
        this.setState({phoneCountry: e.iso2});
    };

    render() {
        const existingPhoneElements = this.state.msisdns.map((p) => {
            return <ExistingPhoneNumber msisdn={p} onRemoved={this._onRemoved} key={p.address} />;
        });

        let addVerifySection = (
            <AccessibleButton onClick={this._onAddClick} kind="primary">
                {_t("Add")}
            </AccessibleButton>
        );
        if (this.state.verifying) {
            const msisdn = this.state.verifyMsisdn;
            addVerifySection = (
              <div>
                  <div>
                      {_t("A text message has been sent to +%(msisdn)s. " +
                          "Please enter the verification code it contains", {msisdn: msisdn})}
                      <br />
                      {this.state.verifyError}
                  </div>
                  <form onSubmit={this._onContinueClick} autoComplete={false} noValidate={true}>
                      <Field id="newPhoneNumberCode" ref="newPhoneNumberCode" label={_t("Verification code")}
                             type="text" autoComplete="off" disabled={this.state.continueDisabled} />
                      <AccessibleButton onClick={this._onContinueClick} kind="primary"
                                        disabled={this.state.continueDisabled}>
                          {_t("Continue")}
                      </AccessibleButton>
                  </form>
              </div>
            );
        }

        return (
            <div className="mx_PhoneNumbers">
                {existingPhoneElements}
                <form onSubmit={this._onAddClick} autoComplete={false}
                      noValidate={true} className="mx_PhoneNumbers_new">
                    <div className="mx_PhoneNumbers_input">
                        <CountryDropdown onOptionChange={this._onCountryChanged}
                                         className="mx_PhoneNumbers_country"
                                         value={this.state.phoneCountry}
                                         disabled={this.state.verifying}
                                         isSmall={true}
                        />
                        <Field id="newPhoneNumber" ref="newPhoneNumber" label={_t("Phone Number")}
                               type="text" autoComplete="off" disabled={this.state.verifying} />
                    </div>
                    {addVerifySection}
                </form>
            </div>
        );
    }
}
