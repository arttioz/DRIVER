'use strict';

describe('ase.views.geography: geoAdd', function () {

    beforeEach(module('ase.mock.resources'));
    beforeEach(module('ase.templates'));
    beforeEach(module('ase.views.geography'));

    var $compile;
    var $httpBackend;
    var $rootScope;
    var ResourcesMock;

    beforeEach(inject(function (_$compile_, _$httpBackend_, _$rootScope_,
                                _ResourcesMock_) {
        $compile = _$compile_;
        $httpBackend = _$httpBackend_;
        $rootScope = _$rootScope_;
        ResourcesMock = _ResourcesMock_;
    }));

    it('should load directive', function () {
        var scope = $rootScope.$new();
        var element = $compile('<ase-geo-add></ase-geo-add>')(scope);
        $rootScope.$apply();

        // 'Upload', 'Save', and 'Cancel' buttons
        expect(element.find('button').length).toEqual(3);
    });

});
