// SPDX-FileCopyrightText: 2022 SAP SE or an SAP affiliate company and CLA-assistant contributors
//
// SPDX-License-Identifier: Apache-2.0

require('../documents/org');
const mongoose = require('mongoose');
const Org = mongoose.model('Org');

const github = require('./github')
const logger = require('./logger')
const webhookService = require('./webhook')

const selection = function (args) {
    const selectArguments = args.orgId ? { orgId: args.orgId } : { org: args.org };

    return selectArguments;
};

const _resp = (message, success = false) => {
    return {'success': success, 'message': message}
}

class OrgService {
    async create(args) {
        return Org.create({
            orgId: args.orgId,
            org: args.org,
            gist: args.gist,
            token: args.token, // TODO: remove this if testing complete.
            excludePattern: args.excludePattern,
            sharedGist: !!args.sharedGist,
            minFileChanges: args.minFileChanges,
            minCodeChanges: args.minCodeChanges,
            allowListPattern: args.allowListPattern,
            allowListPatternOrgs: args.allowListPatternOrgs,
            privacyPolicy: args.privacyPolicy,
            updatedAt: new Date()
        })
    }

    async get(args) {
        return Org.findOne(selection(args))
    }

    async update(args) {
        const org = await this.get(args)
        org.gist = args.gist
        org.token = args.token ? args.token : org.token
        org.sharedGist = !!args.sharedGist
        org.excludePattern = args.excludePattern
        org.minFileChanges = args.minFileChanges
        org.minCodeChanges = args.minCodeChanges
        org.allowListPattern = args.allowListPattern
        org.allowListPatternOrgs = args.allowListPatternOrgs
        org.privacyPolicy = args.privacyPolicy
        org.updatedAt = new Date()

        return org.save()
    }

    async migrate(args, username) {
        const { org: orgArg, orgId: orgIdArg } = args

        // find organization in database
        const org = await Org.findOne({
            org: orgArg,
            orgId: orgIdArg
        })
        if (!org) {
            return _resp('Organization not found')
        }
        if (!org.token) {
            // return a message that the organization is already migrated
            // return success = true because technically, the migration was successful
            return _resp('Organization already migrated', true)
        }
        // try to get GitHub Apps token
        let appToken
        try {
            appToken = await github.getInstallationAccessToken(username)
        } catch(error) {
            return _resp('GitHub App not installed')
        }
        logger.debug('generated app token:', appToken)

        // check if the app has permission to list repositories in the organization
        try {
            await github.call({
                token: appToken,
                obj: 'repos',
                fun: 'listForOrg',
                arg: {
                    org: org.org,
                    per_page: 1
                },
            }, true)
        } catch (error) {
            logger.error(error)
            return _resp('GitHub App has insufficient permissions')
        }

        // remove token from database
        logger.info('Removing token from organization object')
        org.token = undefined
        try {
            // TODO: uncomment this to actually migrate the organization
            // await org.save()
        } catch(error) {
            return _resp('Cannot save organization')
        }
        logger.info('done!')

        // remove webhook from organization
        try {
            await webhookService.removeOrgHook(org.org, appToken)
        } catch(error) {
            logger.warn('cannot remove webhook/s from repository:', error.toString())
        }

        return _resp('Migration successful', true)
    }

    async getMultiple(args) {
        return Org.find({ orgId: { $in: args.orgId } })
    }

    async getOrgWithSharedGist(gist) {
        return Org.find({ gist: gist, sharedGist: true })
    }

    remove(args) {
        return Org.findOneAndRemove(selection(args))
    }
}

const orgService = new OrgService()
module.exports = orgService
