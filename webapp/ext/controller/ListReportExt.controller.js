sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/m/MessageToast"
], function(Fragment, MessageToast) {
    'use strict';

    return {

        onBeforeRebindTableExtension: function(oEvent) {
            this._oTable = this.getView().byId(oEvent.getSource().getId());
        },

        /**
         * Edit selected rows
         * @param {*} oEvent 
         */
        edit: function(oEvent) {
            let iCounter = 0;
            let aItems = this._oTable.getItems()[0].getSelectedItems();
            for (let key in aItems) {
                let oItem = aItems[key];
                let oObject = oItem.getBindingContext().getObject();
                // already a new order number
                if (oObject.Status === 3) {
                    oItem.setSelected(false);
                } else {
                    iCounter++;
                }
            }
            if (iCounter > 0) {
                this._openEditDialog(oEvent);
            } else {
                const oI18n = this.getView().getModel("i18n").getResourceBundle();
                sap.m.MessageToast.show(oI18n.getText("nothingToEdit"));
                this.getView().getModel().refresh(true);
            }
        },

        /**
         * Button pressed
         * Convert and release / Umsetzen und Freigeben
         * @param {*} oEvent 
         */
        release: function(oEvent) {
            let aItems = this._oTable.getItems()[0].getSelectedItems();
            let aObjects = [];
            for (let key in aItems) {
                let oItem = aItems[key];
                let oObject = oItem.getBindingContext().getObject();
                if (oObject.ProductionSupplyArea === "" || oObject.ProductionOrderNew !== "") {
                    oItem.setSelected(false);
                } else {
                    aObjects.push(oObject);
                }
            }
        
            let sPo = "", sRes = "", sResPos = "";
            for (let key in aObjects) {
                sPo += aObjects[key].ProductionOrderOld + ",";
                sRes += aObjects[key].ReservationKey + ",";
                sResPos += aObjects[key].ReservationPosition + ",";
            }

            let mParams = {
                ProductionOrder: sPo,
                ReservationKey: sRes,
                ReservationPosition: sResPos
            }
            this._createProdOrders(mParams);
        },

        /**
         * Open dialog for actions
         * @param {*} oEvent 
         */
        _openEditDialog: function(oEvent) {
            let oView = this.getView();
            if (!this._oCreateDialog) {
                this._oCreateDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.stadler.peo.prodorders.ext.fragments.Edit",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._oCreateDialog.then(function(oDialog) {
                oDialog.open();
            }.bind(this));
        },
        

        /**
         * Close Dialog and save
         * @param {*} oEvent 
         */
        save: function(oEvent) {
            const oI18n = this.getView().getModel("i18n").getResourceBundle();
            // check inputs
            let sPsa = this.getView().byId("idPsa").getValue();
            let sWpl = this.getView().byId("idWorkplace").getValue();
            let sProCon = this.getView().byId("idProdController").getValue();
            let sStd = this.getView().byId("idStart").getValue();
            let oStd = this._dateToUTC(this.getView().byId("idStart").getDateValue());

            //if (sPsa.length > 1 && sWpl.length > 1 && sSto.length > 1 && sStd.length === 10) {
            if (sPsa.length > 1 && sWpl.length > 1 && sStd.length === 10 && sProCon.length > 0) {
                oEvent.getSource().getParent().close();
                // get selected items
                let aObjects = [];
                let aContexts = this.extensionAPI.getSelectedContexts();
                aContexts.forEach(element => {
                    let oObject = element.getModel().getObject(element.getPath());
                    aObjects.push(oObject);
                });
                
                let sPo = "", sRes = "", sResPos = "";
                for (let key in aObjects) {
                    sPo += aObjects[key].ProductionOrderOld + ",";
                    sRes += aObjects[key].ReservationKey + ",";
                    sResPos += aObjects[key].ReservationPosition + ",";
                }

                // Date 31.12.2023 as 20231231
                //let aDate = sStd.split(".");
                //let sStartDate = aDate[2] + aDate[1] + aDate[0];

                let mParams = {
                    ProductionOrder: sPo,
                    ReservationKey: sRes,
                    ReservationPosition: sResPos,
                    OrderStartDate: oStd,
                    ProductionSupplyArea: sPsa,
                    ProductionController: sProCon,
                    Workplace: sWpl
                }
                if (this._sPlant !== "-") {
                    mParams.Plant = this._sPlant;
                }
                this._save(mParams);
                
            } else {
                sap.m.MessageToast.show(oI18n.getText("enterValidInputs"));
            }
        },

        /**
         * get Plant from Value Help Dialog
         * @param {*} oEvent 
         */
        changePsa: function(oEvent) {
            let oVhDialog = this.getView().byId("com.stadler.peo.prodorders::sap.suite.ui.generic.template.ListReport.view.ListReport::xSRAILxC_PEO_MP_PRODORDER_TMP--idPsa-input-valueHelpDialog");
            // only works if the dialog was open
            if (oVhDialog !== undefined) {
                let oObject = JSON.parse(oVhDialog.oRows.aLastContextData[0]);
                this._sProductionSupplyArea = oObject.ProductionSupplyArea;
                this._sPlant = oObject.Plant;
            } else {
                this._sProductionSupplyArea = "-";
                this._sPlant = "-";
            }
        },

        /**
         * get Texts from Value Help Dialog
         * @param {*} oEvent 
         */
        changeWorkplace: function(oEvent) {
            let oVhDialog = this.getView().byId("com.stadler.peo.prodorders::sap.suite.ui.generic.template.ListReport.view.ListReport::xSRAILxC_PEO_MP_PRODORDER_TMP--idWorkplace-input-valueHelpDialog");
            // only works if the dialog was open
            if (oVhDialog !== undefined) {
                let oObject = JSON.parse(oVhDialog.oRows.aLastContextData[0]);
                this.getView().byId("lblWorkplace").setVisible(true);
                this.getView().byId("lblWorkplace").setText(oObject.WorkCenter + " (" + oObject.WorkCenterInternalID_Text + ")");
            } else {
                this.getView().byId("lblWorkplace").setVisible(false);
            }
        },

        /**
         * Save (function import)
         * @param {*} mParams url-parameters
         */
        _save: function(mParams) {
            const oI18n = this.getView().getModel("i18n").getResourceBundle();
            this.getView().setBusy(true);
            let that = this;
            const oModel = this.getView().getModel();
            oModel.callFunction("/setProdOrdersData", {
                method: "POST",
                urlParameters: mParams,
                success: function (oData, oResponse) {
                    if (oData.Status === "OK") {
                        new sap.m.MessageBox.success(oI18n.getText(oData.Message));
                        that._oTable.getItems()[0].removeSelections(true);
                        oModel.refresh(true);
                    } else {
                        new sap.m.MessageBox.error(oI18n.getText(oData.Message));
                    }
                    that.getView().setBusy(false);
                },
                error: function (oError) {
                    that.getView().setBusy(false);
                    let sMessage = oError.message + "\n" + oError.statusText;
                    new sap.m.MessageBox.show(sMessage, {
                        title: oI18n.getText("servererror"),
                        icon: sap.m.MessageBox.Icon.ERROR
                    });
                }
            });
        },

        /**
         * Create new Orders
         * (Convert and release)
         * @param {*} mParams 
         * @returns 
         */
        _createProdOrders: function(mParams) {
            const oI18n = this.getView().getModel("i18n").getResourceBundle();
            this.getView().setBusy(true);
            let that = this;
            const oModel = this.getView().getModel();
            if (mParams.ProductionOrder === "") {
                oModel.refresh(true);
                this.getView().setBusy(false);
                MessageToast.show(oI18n.getText("nothingValid"));
                return;
            }
            oModel.callFunction("/createProdOrders", {
                method: "POST",
                urlParameters: mParams,
                success: function (oData, oResponse) {
                    if (oData.Status === "OK") {
                        new sap.m.MessageBox.success(oI18n.getText(oData.Message));
                        that._oTable.getItems()[0].removeSelections(true);
                        oModel.refresh(true);
                    } else if (oData.Status === "WARN") {
                        new sap.m.MessageBox.warning(oI18n.getText(oData.Message));
                        that._oTable.getItems()[0].removeSelections(true);
                        oModel.refresh(true);
                    } else {
                        new sap.m.MessageBox.error(oI18n.getText(oData.Message));
                    }
                    that.getView().setBusy(false);
                },
                error: function (oError) {
                    that.getView().setBusy(false);
                    let sMessage = oError.message + "\n" + oError.statusText;
                    new sap.m.MessageBox.show(sMessage, {
                        title: oI18n.getText("servererror"),
                        icon: sap.m.MessageBox.Icon.ERROR
                    });
                }
            });
        },

        /**
         * Close dialog
         * @param {*} oEvent 
         */
        closeEditDialog: function(oEvent) {
            oEvent.getSource().getParent().close();
        },

        /**
         * Date with timezone
         * @param {*} oDate 
         * @returns 
         */
        _dateToUTC: function (oDate) {
            let oNewDate = null;
            if (oDate) {
                oNewDate = new Date(oDate);
                oNewDate = new Date(oNewDate.getTime() - oNewDate.getTimezoneOffset() * 60000);
            }
            return oNewDate;
        }
    
    };
});