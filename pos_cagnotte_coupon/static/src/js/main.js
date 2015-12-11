/*
    © 2015  Laetitia Gangloff, Acsone SA/NV (http://www.acsone.eu)
    License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl.html).
*/


openerp.pos_cagnotte_coupon = function (instance) {
    var _t = instance.web._t,
        _lt = instance.web._lt;
    var QWeb = instance.web.qweb;
    module = instance.point_of_sale;

    // Add information relative to cagnotte on order line
    var OrderlineParent = module.Orderline;
    module.Orderline = module.Orderline.extend({
        initialize: function(attributes, options) {
            OrderlineParent.prototype.initialize.apply(this, arguments);
            this.coupon_code = false;
        },
        //sets the coupon code on this order line
        set_coupon: function(coupon_code){
            this.coupon_code = coupon_code;
        },
        // returns the coupon on this orderline
        get_coupon: function(){
            return this.coupon_code;
        },
    });

    // Add information relative to cagnotte on payment line
    var PaymentlineParent = module.Paymentline;
    module.Paymentline = module.Paymentline.extend({
        initialize: function(attributes, options) {
            PaymentlineParent.prototype.initialize.apply(this, arguments);
            this.account_cagnotte_id = false;
        },
        //sets the account_cagnotte_id on this payment line
        set_coupon: function(coupon){
            this.account_cagnotte_id = coupon.id;
            this.set_amount(coupon.solde_cagnotte);
        },
        // returns the coupon on this paymentline
        get_coupon: function(){
            return this.account_cagnotte_id;
        },
        // returns the flag has_cagnotte from journal
        has_cagnotte: function(){
            return this.cashregister.journal.has_cagnotte
        },
        export_as_JSON: function(){
            var json = PaymentlineParent.prototype.export_as_JSON.apply(this,arguments);
            json.account_cagnotte_id = this.get_coupon();
            return json;
        },
    });

    module.PaymentScreenWidget.include({
        // Add behaviour on Set coupon Code button on payment line
        render_paymentline: function(line){
            el_node = this._super(line);
            var self = this;
            if (line.cashregister.journal.has_cagnotte){
                el_node.querySelector('.set-coupon-code')
                    .addEventListener('click', function(){
                        self.pos.pos_widget.screen_selector.show_popup('set-coupon-code-popup', line);});
                }
            return el_node;
        },
        // Re-check coupon usage
        validate_order: function(options) {
            var self = this;
            var cagnotte_not_ok = false;

            var currentOrder = this.pos.get('selectedOrder');
            var plines = currentOrder.get('paymentLines').models;
            for (var i = 0; i < plines.length; i++) {
                // check cagnotte have coupon attached
                if (plines[i].has_cagnotte()){
                    if (! plines[i].get_coupon()) {
                        this.pos_widget.screen_selector.show_popup('error',{
                            'message': _t('Cagnotte without coupon'),
                            'comment': _t('You cannot use cagnotte without a coupon.'),
                        });
                        return;
                    }
                }
            }
            this._super(options);
        },
    });

    module.PosWidget = module.PosWidget.extend({
        /* Overload Section */
        build_widgets: function(){
            this._super();
            this.set_coupon_code_popup = new module.SetCouponCodeWidget(this, {});
            this.set_coupon_code_popup.appendTo($(this.$el));
            this.screen_selector.popup_set['set-coupon-code-popup'] = this.set_coupon_code_popup;
            // Hide the popup because all pop up are displayed at the
            // beginning by default
            this.set_coupon_code_popup.hide();
        },
    });

    module.SetCouponCodeWidget = module.PopUpWidget.extend({
        template:'SetCouponCodeWidget',
        initialize: function() {
            this.line = false;
        },
        start: function(){
            var self = this;

            // Add behaviour on Cancel Button
            this.$('#coupon-popup-cancel').off('click').click(function(){
                this.parentElement.parentElement.children[1].value = null;
                self.hide();
            });
            // Add behaviour on Validate Button
            this.$('#coupon-popup-ok').off('click').click(function(){
                var input_coupon = this.parentElement.parentElement.children[1];
                var coupon_code = this.parentElement.parentElement.children[1].value;
                var Cagnotte = new openerp.Model('account.cagnotte');
                Cagnotte.query(['solde_cagnotte']).
                    filter([['coupon_code','=',coupon_code],
                           ['solde_cagnotte', '>', 0]]).
                    first().then(function (coupon) {
                        if(coupon){
                            var line = self.line;
                            if(line){
                                line.set_coupon(coupon);
                                line.node.querySelector('input').value = coupon.solde_cagnotte;
                            }
                            input_coupon.value = null;
                            self.hide();
                        }else{
                            self.pos_widget.screen_selector.show_popup('error',{
                                'message': _t('Coupon not usable'),
                                'comment': _t('The coupon code ' + coupon_code + ' is not usable'),
                            });
                        return;
                        }
                }, function (err, event) {
                    event.preventDefault();
                    self.pos_widget.screen_selector.show_popup('error',{
                        message: _t('Impossible to check coupon'),
                        comment: _t('Check your internet connection and try again.'),
                    });
                });
            });
        },
        show: function(line){
            var self = this;
            this.line = line;
            this._super();
        },
    });

};